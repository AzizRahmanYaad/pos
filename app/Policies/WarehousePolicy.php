<?php

namespace App\Policies;

use App\Models\User;

class WarehousePolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->can('inventory.manage');
    }

    public function update(User $user): bool
    {
        return $user->can('inventory.manage');
    }

    public function delete(User $user): bool
    {
        return $user->can('inventory.manage');
    }
}
