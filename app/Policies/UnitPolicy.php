<?php

namespace App\Policies;

use App\Models\User;

class UnitPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('products.view');
    }

    public function create(User $user): bool
    {
        return $user->can('products.create');
    }

    public function update(User $user): bool
    {
        return $user->can('products.edit');
    }

    public function delete(User $user): bool
    {
        return $user->can('products.delete');
    }
}
