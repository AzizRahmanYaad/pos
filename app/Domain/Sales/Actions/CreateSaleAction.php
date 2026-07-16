<?php

namespace App\Domain\Sales\Actions;

use App\Domain\Inventory\Actions\RecordStockMovementAction;
use App\Domain\Ledger\Actions\PostLedgerEntryAction;
use App\Domain\PeriodClosing\Services\PeriodGuard;
use App\Domain\Sales\Exceptions\InvalidSalePaymentException;
use App\Models\BusinessSetting;
use App\Models\CashAccount;
use App\Models\Customer;
use App\Models\LedgerEntry;
use App\Models\Product;
use App\Models\Sale;
use App\Models\StockMovement;
use App\Models\Warehouse;
use Illuminate\Support\Facades\DB;

class CreateSaleAction
{
    public function __construct(
        private readonly RecordStockMovementAction $recordStockMovement,
        private readonly PostLedgerEntryAction $postLedgerEntry,
        private readonly PeriodGuard $periodGuard,
    ) {}

    /**
     * @param  array<string, mixed>  $data  customer_id?, warehouse_id, sale_date?, discount?, tax?
     * @param  array<int, array<string, mixed>>  $items  product_id, quantity, unit_id, unit_price, discount?, tax?
     * @param  array<int, array<string, mixed>>  $payments  cash_account_id, method, amount
     */
    public function execute(array $data, array $items, array $payments, int $cashierId): Sale
    {
        $this->periodGuard->assertMutable($data['sale_date'] ?? now());

        return DB::transaction(function () use ($data, $items, $payments, $cashierId) {
            $warehouse = Warehouse::findOrFail($data['warehouse_id']);
            $subtotal = 0.0;
            $itemRows = [];

            foreach ($items as $item) {
                $product = Product::findOrFail($item['product_id']);
                $lineValue = (float) $item['quantity'] * (float) $item['unit_price'];
                $lineTotal = round($lineValue - ($item['discount'] ?? 0) + ($item['tax'] ?? 0), 2);
                $subtotal += $lineValue;

                $stock = $product->stocks()->where('warehouse_id', $data['warehouse_id'])->first();

                $itemRows[] = [
                    'product_id' => $product->id,
                    'quantity' => $item['quantity'],
                    'unit_id' => $item['unit_id'],
                    'unit_price' => $item['unit_price'],
                    'cost_price_snapshot' => $stock ? $stock->average_cost : $product->default_cost,
                    'discount' => $item['discount'] ?? 0,
                    'tax' => $item['tax'] ?? 0,
                    'line_total' => $lineTotal,
                ];
            }

            $discount = (float) ($data['discount'] ?? 0);
            $tax = (float) ($data['tax'] ?? 0);
            $grandTotal = round($subtotal - $discount + $tax, 2);
            $totalTendered = round(array_sum(array_column($payments, 'amount')), 2);

            if ($totalTendered > $grandTotal) {
                throw new InvalidSalePaymentException('Amount tendered cannot exceed the sale total.');
            }

            if (empty($data['customer_id']) && abs($totalTendered - $grandTotal) > 0.01) {
                throw new InvalidSalePaymentException('Walk-in sales must be paid in full.');
            }

            $sale = Sale::create([
                'invoice_number' => 'PENDING',
                'customer_id' => $data['customer_id'] ?? null,
                'warehouse_id' => $data['warehouse_id'],
                'cashier_id' => $cashierId,
                'status' => Sale::STATUS_COMPLETED,
                'sale_date' => $data['sale_date'] ?? now(),
                'subtotal' => round($subtotal, 2),
                'discount' => $discount,
                'tax' => $tax,
                'grand_total' => $grandTotal,
                'paid_amount' => $totalTendered,
                'due_amount' => round($grandTotal - $totalTendered, 2),
            ]);

            $prefix = BusinessSetting::current()->invoice_prefix;
            $sale->update(['invoice_number' => $prefix.str_pad((string) $sale->id, 6, '0', STR_PAD_LEFT)]);

            foreach ($itemRows as $row) {
                $sale->items()->create($row);

                $product = Product::find($row['product_id']);
                if ($product->track_inventory) {
                    $this->recordStockMovement->execute(
                        product: $product,
                        warehouse: $warehouse,
                        type: StockMovement::TYPE_SALE,
                        quantity: -1 * (float) $row['quantity'],
                        reference: $sale,
                        notes: "Sale {$sale->invoice_number}",
                        createdBy: $cashierId,
                        movementDate: $sale->sale_date,
                    );
                }
            }

            $customer = $sale->customer_id ? Customer::find($sale->customer_id) : null;

            if ($customer && $grandTotal > 0) {
                $this->postLedgerEntry->execute(
                    ledgerable: $customer,
                    entryType: LedgerEntry::DEBIT,
                    amount: $grandTotal,
                    source: $sale,
                    description: "Sale {$sale->invoice_number}",
                    transactionDate: $sale->sale_date,
                    createdBy: $cashierId,
                );
            }

            foreach ($payments as $payment) {
                $sale->payments()->create([
                    'cash_account_id' => $payment['cash_account_id'],
                    'method' => $payment['method'],
                    'amount' => $payment['amount'],
                ]);

                $this->postLedgerEntry->execute(
                    ledgerable: CashAccount::findOrFail($payment['cash_account_id']),
                    entryType: LedgerEntry::DEBIT,
                    amount: (float) $payment['amount'],
                    source: $sale,
                    description: "Payment for {$sale->invoice_number}",
                    transactionDate: $sale->sale_date,
                    createdBy: $cashierId,
                );

                if ($customer) {
                    $this->postLedgerEntry->execute(
                        ledgerable: $customer,
                        entryType: LedgerEntry::CREDIT,
                        amount: (float) $payment['amount'],
                        source: $sale,
                        description: "Payment for {$sale->invoice_number}",
                        transactionDate: $sale->sale_date,
                        createdBy: $cashierId,
                    );
                }
            }

            return $sale->load(['items.product', 'payments.cashAccount', 'customer']);
        });
    }
}
