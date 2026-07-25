<?php

namespace App\Policies;

use App\Models\User;

class PayrollRunPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('payroll.view');
    }

    public function create(User $user): bool
    {
        return $user->can('payroll.create');
    }

    public function update(User $user): bool
    {
        return $user->can('payroll.create');
    }
}
