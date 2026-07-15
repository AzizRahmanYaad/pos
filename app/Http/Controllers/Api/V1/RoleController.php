<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Role;

class RoleController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', User::class);

        return Role::query()
            ->with('permissions:id,name')
            ->get(['id', 'name'])
            ->map(fn (Role $role) => [
                'name' => $role->name,
                'permissions' => $role->permissions->pluck('name'),
            ]);
    }
}
