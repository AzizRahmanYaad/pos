<?php

namespace App\Policies;

use App\Models\User;

class PaymentPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('ledger.view');
    }

    public function create(User $user): bool
    {
        return $user->can('payments.manage');
    }
}
