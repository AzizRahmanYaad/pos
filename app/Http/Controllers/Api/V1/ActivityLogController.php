<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ActivityEntryResource;
use App\Models\Activity;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ActivityLogController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()->can('activity.view'), 403);

        $entries = $this->query($request)
            ->with('causer:id,name')
            ->latest('id')
            ->paginate(min($request->integer('per_page', 25), 100))
            ->withQueryString();

        return ActivityEntryResource::collection($entries);
    }

    /**
     * What the filter dropdowns should offer. Only the people and modules
     * that actually appear in this reader's own log — offering a name whose
     * entries they cannot see would be a leak in itself.
     */
    public function filters(Request $request)
    {
        abort_unless($request->user()->can('activity.view'), 403);

        $visible = $this->visibleTo($request->user());

        return response()->json([
            'users' => User::query()
                ->whereIn('id', (clone $visible)->select('causer_id')->whereNotNull('causer_id'))
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (User $user) => ['id' => $user->id, 'name' => $user->name]),
            'modules' => (clone $visible)->distinct()->orderBy('log_name')->pluck('log_name')->filter()->values(),
            'events' => (clone $visible)->distinct()->orderBy('event')->pluck('event')->filter()->values(),
        ]);
    }

    /**
     * The same list the screen shows, as a spreadsheet. Streamed rather than
     * built in memory: a busy shop's year of history is a lot of rows.
     */
    public function export(Request $request): StreamedResponse
    {
        abort_unless($request->user()->can('activity.export'), 403);

        $query = $this->query($request)->with('causer:id,name');
        $filename = 'activity-log-'.now()->format('Y-m-d-His').'.csv';

        return response()->streamDownload(function () use ($query) {
            $handle = fopen('php://output', 'wb');
            fputcsv($handle, ['When', 'User', 'Module', 'Action', 'Record', 'Details', 'IP address']);

            $query->chunkById(500, function ($chunk) use ($handle) {
                foreach ($chunk as $entry) {
                    $properties = $entry->properties ?? collect();
                    $changes = $entry->attribute_changes ?? collect();

                    fputcsv($handle, [
                        $entry->created_at?->toDateTimeString(),
                        $entry->causer?->name ?? '—',
                        $entry->log_name,
                        $entry->event ?? $entry->description,
                        $properties->get('subject_label') ?? $properties->get('path') ?? '',
                        json_encode($changes->get('attributes', []), JSON_UNESCAPED_UNICODE),
                        $entry->ip_address,
                    ]);
                }
            });

            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private function query(Request $request): Builder
    {
        return $this->visibleTo($request->user())
            ->when($request->filled('user_id'), fn (Builder $q) => $q->where('causer_id', $request->integer('user_id')))
            ->when($request->filled('module'), fn (Builder $q) => $q->where('log_name', $request->string('module')))
            ->when($request->filled('event'), fn (Builder $q) => $q->where('event', $request->string('event')))
            ->when($request->filled('from'), fn (Builder $q) => $q->whereDate('created_at', '>=', $request->date('from')))
            ->when($request->filled('to'), fn (Builder $q) => $q->whereDate('created_at', '<=', $request->date('to')))
            ->when($request->filled('search'), function (Builder $q) use ($request) {
                $term = '%'.$request->string('search').'%';

                $q->where(fn (Builder $scope) => $scope
                    ->where('description', 'like', $term)
                    ->orWhere('properties', 'like', $term));
            });
    }

    /**
     * Whose actions this reader may see. The tenant scope already keeps one
     * business out of another's history; on top of that a Company Admin sees
     * their own trail and their own staff's, matching exactly the people
     * they can manage on the Users screen.
     *
     * The platform owner is scoped the same way, to the accounts it opened
     * itself. It used to see every action in every business, which is a
     * different thing entirely: a shopkeeper's cashier voiding a sale is
     * that shop's affair, and reading it is neither the platform's business
     * nor something the shop agreed to. What the platform owner needs is
     * the trail of the Company Admins it issues and renews — no more.
     */
    private function visibleTo(User $actor): Builder
    {
        return Activity::query()->when(
            $actor->isPlatformOwner(),
            fn (Builder $query) => $query->whereIn('causer_id', User::query()
                ->where(fn (Builder $scope) => $scope
                    ->whereNull('created_by')
                    ->orWhereHas('creator', fn (Builder $creator) => $creator
                        ->whereHas('roles', fn (Builder $role) => $role->where('name', 'superadmin'))))
                ->select('id')),
            function (Builder $query) use ($actor) {
                $manageable = User::query()
                    ->where('tenant_id', $actor->tenant_id)
                    ->where(fn (Builder $scope) => $scope
                        ->where('created_by', $actor->id)
                        ->orWhere('id', $actor->id))
                    ->select('id');

                $query->where('tenant_id', $actor->tenant_id)
                    ->whereIn('causer_id', $manageable);
            },
        );
    }
}
