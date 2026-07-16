<?php

namespace App\Domain\Purchases\Actions;

use App\Domain\Inventory\Actions\RecordStockMovementAction;
use App\Domain\Ledger\Actions\PostLedgerEntryAction;
use App\Domain\Purchases\Exceptions\PurchaseAlreadyProcessedException;
use App\Models\LedgerEntry;
use App\Models\Purchase;
use App\Models\StockMovement;
use Illuminate\Support\Facades\DB;

class ReceivePurchaseAction
{
    public function __construct(
        private readonly RecordStockMovementAction $recordStockMovement,
        private readonly PostLedgerEntryAction $postLedgerEntry,
    ) {}

    /**
     * Receive a draft purchase: allocate landed costs across items
     * (proportional to line value by default), post one stock movement per
     * item at its landed unit cost, and credit the supplier for the
     * purchase's grand total (landed costs are capitalized into inventory,
     * not owed to the supplier, so they're excluded from that credit).
     */
    public function execute(Purchase $purchase, int $receivedBy): Purchase
    {
        return DB::transaction(function () use ($purchase, $receivedBy) {
            $locked = Purchase::query()->whereKey($purchase->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== Purchase::STATUS_DRAFT) {
                throw new PurchaseAlreadyProcessedException(
                    "Purchase {$locked->purchase_number} has already been {$locked->status}."
                );
            }

            $items = $purchase->items()->with('product')->get();
            $landedTotal = (float) $purchase->landed_cost_total;
            $totalLineValue = $items->sum(fn ($item) => (float) $item->quantity * (float) $item->unit_cost);

            foreach ($items as $item) {
                $lineValue = (float) $item->quantity * (float) $item->unit_cost;

                $allocatedLandedCost = match (true) {
                    $totalLineValue > 0 => $landedTotal * ($lineValue / $totalLineValue),
                    $items->count() > 0 => $landedTotal / $items->count(),
                    default => 0.0,
                };

                $finalUnitCost = round((float) $item->unit_cost + ($allocatedLandedCost / (float) $item->quantity), 4);

                $this->recordStockMovement->execute(
                    product: $item->product,
                    warehouse: $purchase->warehouse,
                    type: StockMovement::TYPE_PURCHASE,
                    quantity: (float) $item->quantity,
                    unitCost: $finalUnitCost,
                    reference: $purchase,
                    notes: "Purchase {$purchase->purchase_number}",
                    createdBy: $receivedBy,
                    movementDate: $purchase->purchase_date,
                );

                $item->update(['received_quantity' => $item->quantity]);
            }

            if ((float) $purchase->grand_total > 0) {
                $this->postLedgerEntry->execute(
                    ledgerable: $purchase->supplier,
                    entryType: LedgerEntry::CREDIT,
                    amount: (float) $purchase->grand_total,
                    source: $purchase,
                    description: "Purchase {$purchase->purchase_number}",
                    transactionDate: $purchase->purchase_date,
                    createdBy: $receivedBy,
                );
            }

            $locked->update([
                'status' => Purchase::STATUS_RECEIVED,
                'due_amount' => $purchase->grand_total,
            ]);

            return $purchase->fresh(['items.product', 'landedCosts', 'supplier']);
        });
    }
}
