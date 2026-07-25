<?php

namespace App\Policies;

use App\Models\User;

class PeriodClosingPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('period-closing.view');
    }

    public function create(User $user): bool
    {
        return $user->can('period-closing.close');
    }

    public function reopen(User $user): bool
    {
        return $user->can('period-closing.reopen');
    }
}
