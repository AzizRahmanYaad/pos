<?php

namespace App\Policies;

use App\Models\User;

class ExpenseCategoryPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('expenses.manage');
    }

    public function create(User $user): bool
    {
        return $user->can('expenses.manage');
    }

    public function update(User $user): bool
    {
        return $user->can('expenses.manage');
    }

    public function delete(User $user): bool
    {
        return $user->can('expenses.manage');
    }
}
