<?php

namespace App\Policies;

use App\Models\User;

class WarehousePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('inventory.view');
    }

    public function create(User $user): bool
    {
        return $user->can('inventory.adjust');
    }

    public function update(User $user): bool
    {
        return $user->can('inventory.adjust');
    }

    public function delete(User $user): bool
    {
        return $user->can('inventory.adjust');
    }
}
