<?php

namespace App\Policies;

use App\Models\User;

class PurchasePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('purchases.manage');
    }

    public function create(User $user): bool
    {
        return $user->can('purchases.manage');
    }

    public function update(User $user): bool
    {
        return $user->can('purchases.manage');
    }

    public function delete(User $user): bool
    {
        return $user->can('purchases.manage');
    }
}
