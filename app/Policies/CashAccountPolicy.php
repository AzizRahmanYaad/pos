<?php

namespace App\Policies;

use App\Models\User;

class CashAccountPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('ledger.view');
    }

    public function create(User $user): bool
    {
        return $user->can('settings.edit');
    }

    public function update(User $user): bool
    {
        return $user->can('settings.edit');
    }

    public function delete(User $user): bool
    {
        return $user->can('settings.edit');
    }
}
