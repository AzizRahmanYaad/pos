<?php

namespace App\Http\Middleware;

use App\Models\Activity;
use App\Support\ActivityModules;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The safety net under the model log.
 *
 * Saving a record writes a detailed entry of its own, with the fields that
 * changed. This catches everything else a user can do: printing an invoice,
 * exporting a report, running a stock adjustment, or being turned away from
 * a screen they are not allowed to open. If a request changed something and
 * nothing else described it, it is described here.
 *
 * Plain reads are deliberately not recorded. Every list, every dashboard
 * refresh and every balance poll would be an entry, and a log nobody can
 * read through is not an audit trail.
 */
class RecordRequestActivity
{
    /** Handled in detail by the authentication listener instead. */
    private const HANDLED_ELSEWHERE = ['api/v1/auth/login', 'api/v1/auth/logout'];

    /** A GET matching one of these is a user taking data out of the system. */
    private const DOWNLOAD_MARKERS = ['pdf', 'export', 'excel', 'csv', 'print'];

    public function handle(Request $request, Closure $next): Response
    {
        Activity::$recordedThisRequest = 0;

        $response = $next($request);

        try {
            $this->record($request, $response);
        } catch (\Throwable) {
            // Auditing must never be the reason a user's work fails.
        }

        return $response;
    }

    private function record(Request $request, Response $response): void
    {
        $user = $request->user();
        $path = $request->path();

        if ($user === null || in_array($path, self::HANDLED_ELSEWHERE, true)) {
            return;
        }

        $status = $response->getStatusCode();

        // Somebody attempting to change something they are not allowed to
        // change is worth knowing about. A refused *read* is not: the app
        // itself asks for data a user cannot see often enough that logging
        // those buries the entries that matter under pages of noise.
        if (($status === 401 || $status === 403) && ! $request->isMethod('GET')) {
            $this->log($user, $path, 'denied', $request, $status);

            return;
        }

        if ($status >= 400) {
            return;
        }

        $event = $this->eventFor($request);

        if ($event === null) {
            return;
        }

        // A save that wrote a model has already been described, in more
        // detail than this could manage. A download has not: a GET that
        // happens to create a row on the way (a default settings record,
        // say) is not the thing the user did, so it must not silence it.
        if ($event !== 'exported' && Activity::$recordedThisRequest > 0) {
            return;
        }

        $this->log($user, $path, $event, $request, $status);
    }

    private function eventFor(Request $request): ?string
    {
        if ($request->isMethod('GET')) {
            $path = strtolower($request->path());

            foreach (self::DOWNLOAD_MARKERS as $marker) {
                if (str_contains($path, $marker)) {
                    return 'exported';
                }
            }

            return null;
        }

        return match ($request->method()) {
            'POST' => 'created',
            'PUT', 'PATCH' => 'updated',
            'DELETE' => 'deleted',
            default => null,
        };
    }

    private function log($user, string $path, string $event, Request $request, int $status): void
    {
        activity(ActivityModules::forPath($path))
            ->causedBy($user)
            ->withProperties([
                'method' => $request->method(),
                'path' => '/'.ltrim($path, '/'),
                'status' => $status,
            ])
            ->event($event)
            ->log($event);
    }
}
