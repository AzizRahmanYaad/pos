<?php

namespace App\Observers;

use App\Models\Product;
use App\Models\Warehouse;

class ProductObserver
{
    /**
     * Ensure the product has a stock row in every warehouse so quantities
     * can be tracked from the moment it's created.
     */
    public function created(Product $product): void
    {
        $warehouseIds = Warehouse::query()->pluck('id');

        foreach ($warehouseIds as $warehouseId) {
            $product->stocks()->firstOrCreate(['warehouse_id' => $warehouseId]);
        }
    }
}
