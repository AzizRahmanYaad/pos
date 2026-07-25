<?php

namespace App\Http\Requests\Users;

use App\Models\User;
use Spatie\Permission\Models\Role;

/**
 * Shared by the create and edit requests: the ceiling on what the
 * signed-in account is allowed to hand out. Both are deliberately derived
 * from the actor rather than hard-coded, so an account can never grant
 * access it does not hold itself.
 */
trait ResolvesAssignableAccess
{
    /**
     * @return string[]
     */
    protected function assignableRoles(User $actor): array
    {
        $roles = Role::query()->pluck('name')->all();

        if ($actor->isPlatformOwner()) {
            return $roles;
        }

        // Nobody but the platform owner creates platform owners.
        return array_values(array_diff($roles, ['superadmin']));
    }

    /**
     * @return string[]
     */
    protected function assignablePermissions(User $actor): array
    {
        return $actor->grantablePermissions();
    }
}
