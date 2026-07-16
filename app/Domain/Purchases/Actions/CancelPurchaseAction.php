<?php

namespace App\Domain\Purchases\Actions;

use App\Domain\Purchases\Exceptions\PurchaseAlreadyProcessedException;
use App\Models\Purchase;

class CancelPurchaseAction
{
    public function execute(Purchase $purchase): Purchase
    {
        if ($purchase->status !== Purchase::STATUS_DRAFT) {
            throw new PurchaseAlreadyProcessedException(
                "Purchase {$purchase->purchase_number} has already been {$purchase->status} and can no longer be cancelled."
            );
        }

        $purchase->update(['status' => Purchase::STATUS_CANCELLED]);

        return $purchase;
    }
}
