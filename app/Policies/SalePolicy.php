<?php

namespace App\Policies;

use App\Models\User;

class SalePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('pos.access');
    }

    public function create(User $user): bool
    {
        return $user->can('sales.manage');
    }

    public function update(User $user): bool
    {
        return $user->can('sales.manage');
    }
}
