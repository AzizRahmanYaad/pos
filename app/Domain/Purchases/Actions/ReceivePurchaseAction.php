<?php

namespace App\Domain\Purchases\Actions;

use App\Domain\Inventory\Actions\ApplyAutoPricingAction;
use App\Domain\Inventory\Actions\RecordStockMovementAction;
use App\Domain\Ledger\Actions\PostLedgerEntryAction;
use App\Domain\Payments\Actions\RecordPaymentAction;
use App\Domain\PeriodClosing\Services\PeriodGuard;
use App\Domain\Purchases\Exceptions\PurchaseAlreadyProcessedException;
use App\Models\CashAccount;
use App\Models\LedgerEntry;
use App\Models\Payment;
use App\Models\Purchase;
use App\Models\StockMovement;
use Illuminate\Support\Facades\DB;

class ReceivePurchaseAction
{
    public function __construct(
        private readonly RecordStockMovementAction $recordStockMovement,
        private readonly PostLedgerEntryAction $postLedgerEntry,
        private readonly PeriodGuard $periodGuard,
        private readonly ApplyAutoPricingAction $applyAutoPricing,
        private readonly RecordPaymentAction $recordPayment,
    ) {}

    /**
     * Receive a draft purchase: allocate landed costs across items
     * (proportional to line value by default), post one stock movement per
     * item at its landed unit cost, and credit the supplier for the
     * purchase's grand total (landed costs are capitalized into inventory,
     * not owed to the supplier, so they're excluded from that credit).
     *
     * Optionally settle the supplier in the same step: pass `$payment` with
     * `amount`/`cash_account_id`/`method`/`description` to pay the supplier
     * in full or in part right away — whatever isn't paid stays as the
     * purchase's due amount and the supplier's outstanding ledger balance.
     *
     * @param  array{amount: float|string, cash_account_id: int, method?: string, description?: ?string}|null  $payment
     */
    public function execute(Purchase $purchase, int $receivedBy, ?array $payment = null): Purchase
    {
        $this->periodGuard->assertMutable($purchase->purchase_date);

        return DB::transaction(function () use ($purchase, $receivedBy, $payment) {
            $locked = Purchase::query()->whereKey($purchase->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== Purchase::STATUS_DRAFT) {
                throw new PurchaseAlreadyProcessedException(
                    "Purchase {$locked->purchase_number} has already been {$locked->status}."
                );
            }

            $items = $purchase->items()->with('product')->get();
            // Recomputed from the relation (not the cached landed_cost_total
            // column) so landed costs added later via an Expense — after the
            // purchase was created but before it's received — are picked up.
            $landedTotal = (float) $purchase->landedCosts()->sum('amount');
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

            // Every product whose cost this purchase just changed gets its
            // sale price recalculated if it's on margin-based pricing —
            // fixed-price products are left untouched.
            $items->unique('product_id')->each(
                fn ($item) => $this->applyAutoPricing->execute($item->product)
            );

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
                'landed_cost_total' => $landedTotal,
            ]);

            if ($payment !== null && (float) ($payment['amount'] ?? 0) > 0) {
                $this->recordPayment->execute(
                    party: $purchase->supplier,
                    direction: Payment::DIRECTION_OUT,
                    amount: (float) $payment['amount'],
                    cashAccount: CashAccount::findOrFail($payment['cash_account_id']),
                    method: $payment['method'] ?? 'cash',
                    description: $payment['description'] ?? "Payment for {$purchase->purchase_number}",
                    reference: $purchase,
                    receivedBy: $receivedBy,
                    paidAt: $purchase->purchase_date,
                );
            }

            return $purchase->fresh(['items.product', 'landedCosts', 'supplier']);
        });
    }
}
