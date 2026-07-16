<?php

namespace App\Domain\Inventory\Actions;

use App\Domain\Inventory\Exceptions\InsufficientStockException;
use App\Models\Product;
use App\Models\ProductStock;
use App\Models\StockMovement;
use App\Models\Warehouse;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class RecordStockMovementAction
{
    /**
     * Post a stock movement and update the product's cached quantity/average
     * cost for the given warehouse. Runs under a row lock so concurrent
     * sales/purchases against the same product+warehouse can't race.
     *
     * @param  float  $quantity  Signed: positive increases stock, negative decreases it.
     * @param  float|null  $unitCost  Cost per unit for incoming stock; folded into the
     *                                weighted-average cost. Ignored for outgoing movements.
     */
    public function execute(
        Product $product,
        Warehouse $warehouse,
        string $type,
        float $quantity,
        ?float $unitCost = null,
        ?Model $reference = null,
        ?string $notes = null,
        ?int $createdBy = null,
        ?Carbon $movementDate = null,
        bool $allowNegative = false,
    ): StockMovement {
        return DB::transaction(function () use (
            $product, $warehouse, $type, $quantity, $unitCost,
            $reference, $notes, $createdBy, $movementDate, $allowNegative,
        ) {
            $stock = ProductStock::query()
                ->where('product_id', $product->id)
                ->where('warehouse_id', $warehouse->id)
                ->lockForUpdate()
                ->first();

            if (! $stock) {
                $stock = ProductStock::create([
                    'product_id' => $product->id,
                    'warehouse_id' => $warehouse->id,
                ]);
            }

            $currentQuantity = (float) $stock->quantity;
            $newQuantity = round($currentQuantity + $quantity, 4);

            if (! $allowNegative && $newQuantity < 0) {
                throw new InsufficientStockException(
                    "Insufficient stock for product #{$product->id} in warehouse #{$warehouse->id}: ".
                    "requested change {$quantity}, available {$currentQuantity}."
                );
            }

            $newAverageCost = (float) $stock->average_cost;

            if ($quantity > 0 && $unitCost !== null) {
                $currentValue = $currentQuantity * (float) $stock->average_cost;
                $incomingValue = $quantity * $unitCost;
                $newAverageCost = $newQuantity > 0
                    ? round(($currentValue + $incomingValue) / $newQuantity, 4)
                    : (float) $stock->average_cost;
            }

            $stock->quantity = $newQuantity;
            $stock->average_cost = $newAverageCost;
            $stock->save();

            return StockMovement::create([
                'product_id' => $product->id,
                'warehouse_id' => $warehouse->id,
                'type' => $type,
                'quantity' => $quantity,
                'unit_cost' => $unitCost,
                'balance_after' => $newQuantity,
                'reference_type' => $reference?->getMorphClass(),
                'reference_id' => $reference?->getKey(),
                'notes' => $notes,
                'movement_date' => $movementDate ?? now(),
                'created_by' => $createdBy,
            ]);
        });
    }
}
