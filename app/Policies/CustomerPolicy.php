<?php

namespace App\Policies;

use App\Models\User;

class CustomerPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('customers.view');
    }

    public function create(User $user): bool
    {
        return $user->can('customers.create');
    }

    public function update(User $user): bool
    {
        return $user->can('customers.edit');
    }

    public function delete(User $user): bool
    {
        return $user->can('customers.delete');
    }
}
