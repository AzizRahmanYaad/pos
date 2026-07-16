<?php

namespace App\Domain\Inventory\Actions;

use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Warehouse;

class AdjustStockAction
{
    public function __construct(
        private readonly RecordStockMovementAction $recordStockMovement,
    ) {}

    /**
     * Record a manual stock correction. $quantity is signed: positive adds
     * stock, negative removes it. An optional $unitCost only affects the
     * weighted-average cost for positive adjustments.
     */
    public function execute(
        Product $product,
        Warehouse $warehouse,
        float $quantity,
        string $reason,
        ?float $unitCost,
        int $createdBy,
    ): StockMovement {
        return $this->recordStockMovement->execute(
            product: $product,
            warehouse: $warehouse,
            type: StockMovement::TYPE_ADJUSTMENT,
            quantity: $quantity,
            unitCost: $unitCost,
            notes: $reason,
            createdBy: $createdBy,
        );
    }
}
