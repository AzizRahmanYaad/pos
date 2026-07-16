<?php

namespace App\Policies;

use App\Models\User;

class PeriodClosingPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('reports.view') || $user->can('period-closing.close');
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
