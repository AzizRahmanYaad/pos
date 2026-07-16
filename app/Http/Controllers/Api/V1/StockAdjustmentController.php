<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Inventory\Actions\AdjustStockAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\StoreStockAdjustmentRequest;
use App\Http\Resources\StockMovementResource;
use App\Models\Product;
use App\Models\Warehouse;

class StockAdjustmentController extends Controller
{
    public function store(StoreStockAdjustmentRequest $request, AdjustStockAction $adjustStock): StockMovementResource
    {
        $movement = $adjustStock->execute(
            product: Product::findOrFail($request->validated('product_id')),
            warehouse: Warehouse::findOrFail($request->validated('warehouse_id')),
            quantity: (float) $request->validated('quantity'),
            reason: $request->validated('reason'),
            unitCost: $request->validated('unit_cost') !== null ? (float) $request->validated('unit_cost') : null,
            createdBy: $request->user()->id,
        );

        return new StockMovementResource($movement->load(['product', 'warehouse', 'creator']));
    }
}
