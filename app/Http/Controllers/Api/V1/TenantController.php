<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use Illuminate\Http\Request;

class TenantController extends Controller
{
    /**
     * The businesses on the platform, each with how many accounts it has
     * and how many it is allowed, so the superadmin can see at a glance
     * who is at their ceiling.
     */
    public function index()
    {
        $this->authorize('viewAny', Tenant::class);

        return Tenant::query()
            ->withCount('users')
            ->orderBy('name')
            ->get()
            ->map(fn (Tenant $tenant) => $this->present($tenant));
    }

    /**
     * Set how many accounts a business may create. Null lifts the ceiling
     * entirely. A limit below the current headcount is accepted and simply
     * blocks further additions — it never deletes anyone's staff.
     */
    public function update(Request $request, Tenant $tenant)
    {
        $this->authorize('update', $tenant);

        $validated = $request->validate([
            'max_users' => ['present', 'nullable', 'integer', 'min:1'],
        ]);

        $tenant->update(['max_users' => $validated['max_users']]);

        return $this->present($tenant->loadCount('users'));
    }

    /**
     * @return array<string, mixed>
     */
    private function present(Tenant $tenant): array
    {
        $used = $tenant->users_count ?? $tenant->userCount();

        return [
            'id' => $tenant->id,
            'name' => $tenant->name,
            'max_users' => $tenant->max_users,
            'user_count' => $used,
            'remaining_user_slots' => $tenant->max_users === null ? null : max(0, $tenant->max_users - $used),
        ];
    }
}
