<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Purchases\Actions\CancelPurchaseAction;
use App\Domain\Purchases\Actions\CreatePurchaseAction;
use App\Domain\Purchases\Actions\ReceivePurchaseAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Purchases\StorePurchaseRequest;
use App\Http\Resources\PurchaseResource;
use App\Models\Purchase;
use Illuminate\Http\Response;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class PurchaseController extends Controller
{
    public function index()
    {
        $this->authorize('viewAny', Purchase::class);

        $purchases = QueryBuilder::for(Purchase::class)
            ->allowedFilters(
                AllowedFilter::exact('supplier_id'),
                AllowedFilter::exact('warehouse_id'),
                AllowedFilter::exact('status'),
            )
            ->allowedSorts('purchase_date', 'created_at', 'grand_total')
            ->with(['supplier', 'warehouse'])
            ->defaultSort('-purchase_date')
            ->paginate(request()->integer('per_page', 20));

        return PurchaseResource::collection($purchases);
    }

    public function store(StorePurchaseRequest $request, CreatePurchaseAction $createPurchase): PurchaseResource
    {
        $purchase = $createPurchase->execute(
            data: $request->only(['supplier_id', 'warehouse_id', 'purchase_date', 'discount', 'tax']),
            items: $request->validated('items'),
            landedCosts: $request->validated('landed_costs') ?? [],
            createdBy: $request->user()->id,
        );

        return new PurchaseResource($purchase);
    }

    public function show(Purchase $purchase): PurchaseResource
    {
        $this->authorize('viewAny', Purchase::class);

        return new PurchaseResource($purchase->load(['supplier', 'warehouse', 'items.product', 'landedCosts']));
    }

    public function receive(Purchase $purchase, ReceivePurchaseAction $receivePurchase): PurchaseResource
    {
        $this->authorize('update', $purchase);

        $received = $receivePurchase->execute($purchase, request()->user()->id);

        return new PurchaseResource($received);
    }

    public function cancel(Purchase $purchase, CancelPurchaseAction $cancelPurchase): PurchaseResource
    {
        $this->authorize('update', $purchase);

        return new PurchaseResource($cancelPurchase->execute($purchase));
    }

    public function destroy(Purchase $purchase): Response
    {
        $this->authorize('delete', $purchase);

        if ($purchase->status !== Purchase::STATUS_DRAFT) {
            abort(409, 'Only draft purchases can be deleted.');
        }

        $purchase->delete();

        return response()->noContent();
    }
}
