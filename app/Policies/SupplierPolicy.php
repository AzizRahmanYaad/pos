<?php

namespace App\Policies;

use App\Models\User;

class SupplierPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('suppliers.view');
    }

    public function create(User $user): bool
    {
        return $user->can('suppliers.create');
    }

    public function update(User $user): bool
    {
        return $user->can('suppliers.edit');
    }

    public function delete(User $user): bool
    {
        return $user->can('suppliers.delete');
    }
}
