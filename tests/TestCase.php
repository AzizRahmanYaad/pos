<?php

namespace Tests;

use App\Models\User;
use App\Support\Permissions;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Set an account up the way the Users screen does: the role as a label,
     * plus that role's preset ticked onto the account itself.
     *
     * Staff roles carry no permissions of their own — authority lives on
     * the account so that unticking a box in the permission screen always
     * takes effect (see Permissions::rolePermissions()). Tests therefore
     * have to grant a manager or cashier the same way the product does,
     * rather than leaning on the role alone.
     */
    protected function grantRole(User $user, string $role): User
    {
        $user->assignRole($role);

        $preset = Permissions::presets()[$role] ?? null;

        if ($preset !== null) {
            $user->syncPermissions($preset);
        }

        return $user->refresh();
    }
}
