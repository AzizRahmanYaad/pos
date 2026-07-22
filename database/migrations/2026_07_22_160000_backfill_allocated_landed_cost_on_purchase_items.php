<?php

use App\Models\Purchase;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Purchases received before the allocated_landed_cost column existed
     * never had it filled in, even though their landed costs were already
     * folded into the stock's average cost at the time. Recompute each
     * item's share using the exact same proportional-by-value formula
     * ReceivePurchaseAction uses, so the purchase/sale detail pages show
     * the real number instead of a stale 0.
     */
    public function up(): void
    {
        Purchase::query()
            ->where('status', Purchase::STATUS_RECEIVED)
            ->where('landed_cost_total', '>', 0)
            ->with('items')
            ->chunkById(100, function ($purchases) {
                foreach ($purchases as $purchase) {
                    $items = $purchase->items;
                    $allocations = Purchase::allocateLandedCost($items, (float) $purchase->landed_cost_total);

                    foreach ($items as $item) {
                        if ((float) $item->allocated_landed_cost > 0) {
                            continue;
                        }

                        $item->update(['allocated_landed_cost' => round($allocations[$item->id], 4)]);
                    }
                }
            });
    }

    public function down(): void
    {
        // Irreversible data backfill — nothing to undo.
    }
};
