<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Users\ResolvesAssignableAccess;
use App\Models\User;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Role;

class RoleController extends Controller
{
    use ResolvesAssignableAccess;

    /**
     * Only the roles this account may actually hand out.
     *
     * Returning every role meant a Company Admin was offered "superadmin"
     * in the dropdown — the request was rejected on save, but it should
     * never have been on the menu in the first place.
     */
    public function index(Request $request)
    {
        $this->authorize('viewAny', User::class);

        return Role::query()
            ->whereIn('name', $this->assignableRoles($request->user()))
            ->with('permissions:id,name')
            ->get(['id', 'name'])
            ->map(fn (Role $role) => [
                'name' => $role->name,
                'permissions' => $role->permissions->pluck('name'),
            ])
            ->values();
    }
}
