<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\StockMovementResource;
use App\Models\StockMovement;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class StockMovementController extends Controller
{
    public function index()
    {
        $movements = QueryBuilder::for(StockMovement::class)
            ->allowedFilters(
                AllowedFilter::exact('product_id'),
                AllowedFilter::exact('warehouse_id'),
                AllowedFilter::exact('type'),
            )
            ->allowedSorts('movement_date', 'created_at')
            ->with(['product', 'warehouse', 'creator'])
            ->defaultSort('-movement_date')
            ->paginate(request()->integer('per_page', 25));

        return StockMovementResource::collection($movements);
    }
}
