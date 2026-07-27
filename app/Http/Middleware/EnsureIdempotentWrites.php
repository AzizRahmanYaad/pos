<?php

namespace App\Http\Middleware;

use App\Models\IdempotencyKey;
use App\Support\TenantContext;
use Closure;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Makes a write safe to send twice.
 *
 * A device that sold while offline replays those sales when it reconnects,
 * and it cannot always know whether the first attempt reached us — a
 * response lost on a dying connection looks exactly like a request that
 * never arrived. The device therefore sends the same Idempotency-Key both
 * times, and this hands back the original answer rather than ringing up a
 * second sale.
 *
 * Requests without the header are untouched, so nothing about the online
 * application changes.
 */
class EnsureIdempotentWrites
{
    public const HEADER = 'Idempotency-Key';

    /** How long a remembered answer stays available for replay. */
    public const RETENTION_DAYS = 30;

    public function handle(Request $request, Closure $next): Response
    {
        $key = $request->header(self::HEADER);

        if ($key === null || $request->isMethod('GET') || $request->user() === null) {
            return $next($request);
        }

        if (! Str::isUuid($key)) {
            return response()->json([
                'message' => __('The idempotency key must be a UUID.'),
            ], 400);
        }

        $fingerprint = $this->fingerprint($request);
        $existing = IdempotencyKey::query()->where('key', $key)->first();

        if ($existing !== null) {
            return $this->replay($existing, $request, $fingerprint) ?? $next($request);
        }

        // Claim the key before doing the work. Two devices syncing the same
        // queued sale at once both reach here; the unique index decides
        // which one performs it, and the loser waits rather than repeating it.
        try {
            $record = IdempotencyKey::create([
                'key' => $key,
                'user_id' => $request->user()->id,
                'tenant_id' => TenantContext::id(),
                'method' => $request->method(),
                'path' => $request->path(),
                'request_fingerprint' => $fingerprint,
            ]);
        } catch (QueryException) {
            return response()->json([
                'message' => __('This change is already being processed. Try again in a moment.'),
            ], 409);
        }

        $response = $next($request);

        // Only a success is worth remembering. A validation error should be
        // returned again on retry, not frozen forever — the device may well
        // send a corrected version under the same key.
        if ($response->getStatusCode() < 400) {
            $record->update([
                'response_status' => $response->getStatusCode(),
                'response_body' => $response->getContent(),
            ]);
        } else {
            $record->delete();
        }

        return $response;
    }

    /**
     * The stored answer, or null when the request should simply proceed.
     */
    private function replay(IdempotencyKey $existing, Request $request, string $fingerprint): ?Response
    {
        if ($existing->user_id !== $request->user()->id) {
            // Somebody else's key. Never hand back their answer.
            return response()->json([
                'message' => __('This idempotency key belongs to another account.'),
            ], 409);
        }

        if ($existing->request_fingerprint !== $fingerprint) {
            return response()->json([
                'message' => __('This idempotency key was already used for a different change.'),
            ], 422);
        }

        if (! $existing->isComplete()) {
            // The first attempt is still running, or died mid-flight. Either
            // way, repeating the work now risks doing it twice.
            return response()->json([
                'message' => __('This change is already being processed. Try again in a moment.'),
            ], 409);
        }

        return response(
            $existing->response_body,
            $existing->response_status,
        )->header('Content-Type', 'application/json')
            ->header('Idempotent-Replay', 'true');
    }

    private function fingerprint(Request $request): string
    {
        return hash('sha256', implode('|', [
            $request->method(),
            $request->path(),
            $request->getContent(),
        ]));
    }
}
