<?php

namespace App\Policies;

use App\Models\User;

class ProductPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->can('products.manage');
    }

    public function update(User $user): bool
    {
        return $user->can('products.manage');
    }

    public function delete(User $user): bool
    {
        return $user->can('products.manage');
    }
}
