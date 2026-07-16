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
        return $user->can('settings.manage');
    }

    public function update(User $user): bool
    {
        return $user->can('settings.manage');
    }

    public function delete(User $user): bool
    {
        return $user->can('settings.manage');
    }
}
