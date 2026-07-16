<?php

namespace App\Policies;

use App\Models\User;

class CustomerPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->can('sales.manage');
    }

    public function update(User $user): bool
    {
        return $user->can('sales.manage');
    }

    public function delete(User $user): bool
    {
        return $user->can('sales.manage');
    }
}
