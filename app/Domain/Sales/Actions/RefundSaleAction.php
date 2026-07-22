<?php

namespace App\Domain\Sales\Actions;

use App\Domain\Inventory\Actions\RecordStockMovementAction;
use App\Domain\Ledger\Actions\PostLedgerEntryAction;
use App\Domain\Sales\Exceptions\InvalidRefundException;
use App\Domain\Sales\Exceptions\SaleAlreadyProcessedException;
use App\Models\LedgerEntry;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\StockMovement;
use Illuminate\Support\Facades\DB;

class RefundSaleAction
{
    public function __construct(
        private readonly RecordStockMovementAction $recordStockMovement,
        private readonly PostLedgerEntryAction $postLedgerEntry,
    ) {}

    /**
     * Refund a sale, in full or for specific items/quantities: return the
     * refunded quantity to stock at its original cost snapshot, give back
     * the corresponding share of whatever cash was actually collected (via
     * the same cash accounts, proportional to the refunded value), and
     * forgive the same proportion of the customer's remaining due amount.
     *
     * Passing `$items` as null refunds everything still outstanding on the
     * sale (a full return); passing specific `{sale_item_id, quantity}`
     * rows refunds only those — a customer can return one item while
     * keeping the rest. A sale that still has unreturned items afterward is
     * marked partially refunded rather than refunded, so its remaining
     * (unreturned) revenue keeps counting in reports.
     *
     * @param  array<int, array{sale_item_id: int, quantity: float|string}>|null  $items
     */
    public function execute(Sale $sale, int $refundedBy, ?array $items = null): Sale
    {
        return DB::transaction(function () use ($sale, $refundedBy, $items) {
            $locked = Sale::query()->whereKey($sale->id)->lockForUpdate()->firstOrFail();

            if (! in_array($locked->status, [Sale::STATUS_COMPLETED, Sale::STATUS_PARTIALLY_REFUNDED], true)) {
                throw new SaleAlreadyProcessedException(
                    "Sale {$locked->invoice_number} has already been {$locked->status}."
                );
            }

            $saleItems = $sale->items()->with('product')->get();
            $toRefund = $this->resolveRefundLines($saleItems, $items);

            if ($toRefund->isEmpty()) {
                throw new InvalidRefundException('Nothing left to refund on this sale.');
            }

            $refundValue = 0.0;

            foreach ($toRefund as $entry) {
                /** @var SaleItem $item */
                $item = $entry['item'];
                $quantity = $entry['quantity'];

                if ($item->product->track_inventory) {
                    $this->recordStockMovement->execute(
                        product: $item->product,
                        warehouse: $sale->warehouse,
                        type: StockMovement::TYPE_RETURN_IN,
                        quantity: $quantity,
                        unitCost: (float) $item->cost_price_snapshot,
                        reference: $sale,
                        notes: "Refund {$sale->invoice_number}",
                        createdBy: $refundedBy,
                    );
                }

                $itemQuantity = (float) $item->quantity;
                $refundValue += $itemQuantity > 0 ? (float) $item->line_total * ($quantity / $itemQuantity) : 0.0;

                $item->update(['refunded_quantity' => (float) $item->refunded_quantity + $quantity]);
            }

            $refundValue = round($refundValue, 2);
            $grandTotal = (float) $sale->grand_total;
            $fraction = $grandTotal > 0 ? min(1.0, $refundValue / $grandTotal) : 0.0;

            $cashRefunded = 0.0;
            foreach ($sale->payments as $payment) {
                $refundToAccount = round((float) $payment->amount * $fraction, 2);
                if ($refundToAccount <= 0) {
                    continue;
                }

                $this->postLedgerEntry->execute(
                    ledgerable: $payment->cashAccount,
                    entryType: LedgerEntry::CREDIT,
                    amount: $refundToAccount,
                    source: $sale,
                    description: "Refund {$sale->invoice_number}",
                    createdBy: $refundedBy,
                );
                $cashRefunded += $refundToAccount;
            }

            // Based on the *original* due amount (grand total minus what was
            // actually paid), not the already-shrunk current due_amount —
            // otherwise a second partial refund on the same sale would
            // under-forgive, since its fraction is still relative to the
            // whole sale but the base it's applied to would have already
            // been reduced by the first refund.
            $originalDueAmount = max(0, round($grandTotal - (float) $sale->payments->sum('amount'), 2));
            $dueForgiven = round($originalDueAmount * $fraction, 2);
            if ($sale->customer_id && $dueForgiven > 0) {
                $this->postLedgerEntry->execute(
                    ledgerable: $sale->customer,
                    entryType: LedgerEntry::CREDIT,
                    amount: $dueForgiven,
                    source: $sale,
                    description: "Refund {$sale->invoice_number}",
                    createdBy: $refundedBy,
                );
            }

            $fullyReturned = $sale->items()->get()->every(
                fn (SaleItem $item) => (float) $item->refunded_quantity >= (float) $item->quantity - 0.0001
            );

            $locked->update([
                'status' => $fullyReturned ? Sale::STATUS_REFUNDED : Sale::STATUS_PARTIALLY_REFUNDED,
                'paid_amount' => max(0, round((float) $sale->paid_amount - $cashRefunded, 2)),
                'due_amount' => max(0, round((float) $sale->due_amount - $dueForgiven, 2)),
            ]);

            return $sale->fresh(['items.product', 'payments.cashAccount', 'customer']);
        });
    }

    /**
     * @param  \Illuminate\Support\Collection<int, SaleItem>  $saleItems
     * @param  array<int, array{sale_item_id: int, quantity: float|string}>|null  $items
     * @return \Illuminate\Support\Collection<int, array{item: SaleItem, quantity: float}>
     */
    private function resolveRefundLines($saleItems, ?array $items)
    {
        if ($items === null) {
            return $saleItems
                ->map(function (SaleItem $item) {
                    $remaining = round((float) $item->quantity - (float) $item->refunded_quantity, 4);

                    return $remaining > 0.0001 ? ['item' => $item, 'quantity' => $remaining] : null;
                })
                ->filter()
                ->values();
        }

        $byId = $saleItems->keyBy('id');

        return collect($items)->map(function (array $row) use ($byId) {
            $item = $byId->get($row['sale_item_id']);
            if (! $item) {
                throw new InvalidRefundException('That item does not belong to this sale.');
            }

            $remaining = round((float) $item->quantity - (float) $item->refunded_quantity, 4);
            $quantity = (float) $row['quantity'];

            if ($quantity <= 0 || $quantity > $remaining + 0.0001) {
                throw new InvalidRefundException(
                    "Only {$remaining} of \"{$item->product->name}\" is left to return."
                );
            }

            return ['item' => $item, 'quantity' => $quantity];
        })->values();
    }
}
