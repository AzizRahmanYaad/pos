<?php

namespace App\Policies;

use App\Models\Sale;
use App\Models\User;

class SalePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('sales.view');
    }

    /**
     * A cashier sees the sales they rang up; seeing everybody's takings is
     * a separate grant on top.
     */
    public function view(User $user, Sale $sale): bool
    {
        return $user->can('sales.view')
            && ($user->can('sales.view-all') || $sale->cashier_id === $user->id);
    }

    public function create(User $user): bool
    {
        return $user->can('sales.create');
    }

    /** Refunding a sale is the destructive action on this module. */
    public function update(User $user, Sale $sale): bool
    {
        return $user->can('sales.delete') && $this->view($user, $sale);
    }
}
