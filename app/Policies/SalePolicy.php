<?php

namespace App\Policies;

use App\Models\Sale;
use App\Models\User;

class SalePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('pos.access');
    }

    public function view(User $user, Sale $sale): bool
    {
        return $user->can('sales.view-all') || $sale->cashier_id === $user->id;
    }

    public function create(User $user): bool
    {
        return $user->can('sales.manage');
    }

    public function update(User $user, Sale $sale): bool
    {
        return $user->can('sales.manage') && $this->view($user, $sale);
    }
}
