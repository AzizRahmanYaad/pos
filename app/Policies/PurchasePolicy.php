<?php

namespace App\Policies;

use App\Models\User;

class PurchasePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('purchases.view');
    }

    public function create(User $user): bool
    {
        return $user->can('purchases.create');
    }

    public function update(User $user): bool
    {
        return $user->can('purchases.edit');
    }

    public function delete(User $user): bool
    {
        return $user->can('purchases.delete');
    }
}
