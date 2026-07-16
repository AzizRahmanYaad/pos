<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Sales\Actions\CreateSaleAction;
use App\Domain\Sales\Actions\RefundSaleAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Sales\StoreSaleRequest;
use App\Http\Resources\SaleResource;
use App\Models\Sale;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class SaleController extends Controller
{
    public function index()
    {
        $this->authorize('viewAny', Sale::class);

        $sales = QueryBuilder::for(Sale::class)
            ->allowedFilters(
                AllowedFilter::exact('customer_id'),
                AllowedFilter::exact('warehouse_id'),
                AllowedFilter::exact('status'),
                AllowedFilter::exact('cashier_id'),
            )
            ->allowedSorts('sale_date', 'created_at', 'grand_total')
            ->with(['customer', 'warehouse', 'cashier'])
            ->defaultSort('-sale_date')
            ->paginate(request()->integer('per_page', 20));

        return SaleResource::collection($sales);
    }

    public function store(StoreSaleRequest $request, CreateSaleAction $createSale): SaleResource
    {
        $sale = $createSale->execute(
            data: $request->only(['customer_id', 'warehouse_id', 'sale_date', 'discount', 'tax']),
            items: $request->validated('items'),
            payments: $request->validated('payments') ?? [],
            cashierId: $request->user()->id,
        );

        return new SaleResource($sale);
    }

    public function show(Sale $sale): SaleResource
    {
        $this->authorize('viewAny', Sale::class);

        return new SaleResource($sale->load(['items.product', 'payments.cashAccount', 'customer', 'warehouse', 'cashier']));
    }

    public function refund(Sale $sale, RefundSaleAction $refundSale): SaleResource
    {
        $this->authorize('update', $sale);

        return new SaleResource($refundSale->execute($sale, request()->user()->id));
    }
}
