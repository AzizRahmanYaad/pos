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

        // Only the platform owner mints platform owners and business
        // owners. A Company Admin hires staff — letting them create a
        // second admin would hand out an account they then could not see
        // or manage, and one able to bypass their own limits.
        return array_values(array_diff($roles, ['superadmin', 'admin']));
    }

    /**
     * @return string[]
     */
    protected function assignablePermissions(User $actor): array
    {
        return $actor->grantablePermissions();
    }
}
