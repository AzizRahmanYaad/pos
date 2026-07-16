<?php

namespace App\Domain\Purchases\Actions;

use App\Models\BusinessSetting;
use App\Models\Purchase;
use Illuminate\Support\Facades\DB;

class CreatePurchaseAction
{
    /**
     * @param  array<string, mixed>  $data  supplier_id, warehouse_id, purchase_date, discount?, tax?
     * @param  array<int, array<string, mixed>>  $items  product_id, quantity, unit_id, unit_cost, discount?, tax?
     * @param  array<int, array<string, mixed>>  $landedCosts  description, amount, allocation_method?, expense_id?
     */
    public function execute(array $data, array $items, array $landedCosts, int $createdBy): Purchase
    {
        return DB::transaction(function () use ($data, $items, $landedCosts, $createdBy) {
            $subtotal = 0.0;
            $itemRows = [];

            foreach ($items as $item) {
                $lineValue = (float) $item['quantity'] * (float) $item['unit_cost'];
                $lineTotal = round($lineValue - ($item['discount'] ?? 0) + ($item['tax'] ?? 0), 2);
                $subtotal += $lineValue;

                $itemRows[] = [
                    'product_id' => $item['product_id'],
                    'quantity' => $item['quantity'],
                    'unit_id' => $item['unit_id'],
                    'unit_cost' => $item['unit_cost'],
                    'discount' => $item['discount'] ?? 0,
                    'tax' => $item['tax'] ?? 0,
                    'line_total' => $lineTotal,
                ];
            }

            $landedTotal = array_sum(array_column($landedCosts, 'amount'));
            $discount = (float) ($data['discount'] ?? 0);
            $tax = (float) ($data['tax'] ?? 0);
            $grandTotal = round($subtotal - $discount + $tax, 2);

            $purchase = Purchase::create([
                'purchase_number' => 'PENDING',
                'supplier_id' => $data['supplier_id'],
                'warehouse_id' => $data['warehouse_id'],
                'status' => Purchase::STATUS_DRAFT,
                'purchase_date' => $data['purchase_date'],
                'subtotal' => round($subtotal, 2),
                'discount' => $discount,
                'tax' => $tax,
                'landed_cost_total' => round($landedTotal, 2),
                'grand_total' => $grandTotal,
                'paid_amount' => 0,
                'due_amount' => $grandTotal,
                'created_by' => $createdBy,
            ]);

            $prefix = BusinessSetting::current()->purchase_prefix;
            $purchase->update(['purchase_number' => $prefix.str_pad((string) $purchase->id, 6, '0', STR_PAD_LEFT)]);

            $purchase->items()->createMany($itemRows);
            $purchase->landedCosts()->createMany($landedCosts);

            return $purchase->load(['items.product', 'landedCosts']);
        });
    }
}
