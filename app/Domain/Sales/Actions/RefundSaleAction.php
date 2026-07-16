<?php

namespace App\Domain\Sales\Actions;

use App\Domain\Inventory\Actions\RecordStockMovementAction;
use App\Domain\Ledger\Actions\PostLedgerEntryAction;
use App\Domain\Sales\Exceptions\SaleAlreadyProcessedException;
use App\Models\LedgerEntry;
use App\Models\Sale;
use App\Models\StockMovement;
use Illuminate\Support\Facades\DB;

class RefundSaleAction
{
    public function __construct(
        private readonly RecordStockMovementAction $recordStockMovement,
        private readonly PostLedgerEntryAction $postLedgerEntry,
    ) {}

    /**
     * Fully refund a completed sale: return every item's quantity to stock
     * at its original cost snapshot, give back whatever cash was actually
     * collected (via the same cash accounts), and reverse the net effect
     * on the customer's balance (their outstanding due_amount, not the
     * full grand_total — the portion already paid was already settled).
     */
    public function execute(Sale $sale, int $refundedBy): Sale
    {
        return DB::transaction(function () use ($sale, $refundedBy) {
            $locked = Sale::query()->whereKey($sale->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== Sale::STATUS_COMPLETED) {
                throw new SaleAlreadyProcessedException(
                    "Sale {$locked->invoice_number} has already been {$locked->status}."
                );
            }

            $items = $sale->items()->with('product')->get();

            foreach ($items as $item) {
                if (! $item->product->track_inventory) {
                    continue;
                }

                $this->recordStockMovement->execute(
                    product: $item->product,
                    warehouse: $sale->warehouse,
                    type: StockMovement::TYPE_RETURN_IN,
                    quantity: (float) $item->quantity,
                    unitCost: (float) $item->cost_price_snapshot,
                    reference: $sale,
                    notes: "Refund {$sale->invoice_number}",
                    createdBy: $refundedBy,
                );
            }

            foreach ($sale->payments as $payment) {
                $this->postLedgerEntry->execute(
                    ledgerable: $payment->cashAccount,
                    entryType: LedgerEntry::CREDIT,
                    amount: (float) $payment->amount,
                    source: $sale,
                    description: "Refund {$sale->invoice_number}",
                    createdBy: $refundedBy,
                );
            }

            if ($sale->customer_id && (float) $sale->due_amount > 0) {
                $this->postLedgerEntry->execute(
                    ledgerable: $sale->customer,
                    entryType: LedgerEntry::CREDIT,
                    amount: (float) $sale->due_amount,
                    source: $sale,
                    description: "Refund {$sale->invoice_number}",
                    createdBy: $refundedBy,
                );
            }

            $locked->update(['status' => Sale::STATUS_REFUNDED]);

            return $sale->fresh(['items.product', 'payments.cashAccount', 'customer']);
        });
    }
}
