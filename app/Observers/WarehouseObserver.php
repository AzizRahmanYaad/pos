<?php

namespace App\Observers;

use App\Models\Product;
use App\Models\Warehouse;

class WarehouseObserver
{
    /**
     * Ensure every existing product has a stock row in the new warehouse.
     */
    public function created(Warehouse $warehouse): void
    {
        $productIds = Product::query()->pluck('id');

        foreach ($productIds as $productId) {
            $warehouse->productStocks()->firstOrCreate(['product_id' => $productId]);
        }
    }
}
