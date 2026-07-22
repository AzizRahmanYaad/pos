<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Sales\Actions\CreateSaleAction;
use App\Domain\Sales\Actions\RefundSaleAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Sales\RefundSaleRequest;
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

        $query = QueryBuilder::for(Sale::class)
            ->allowedFilters(
                AllowedFilter::exact('customer_id'),
                AllowedFilter::exact('warehouse_id'),
                AllowedFilter::exact('status'),
                AllowedFilter::exact('cashier_id'),
                AllowedFilter::callback('search', function ($query, $value) {
                    $query->where(function ($query) use ($value) {
                        $query->where('invoice_number', 'like', "%{$value}%")
                            ->orWhereHas('customer', fn ($q) => $q->where('name', 'like', "%{$value}%"));
                    });
                }),
                AllowedFilter::callback('from', fn ($query, $value) => $query->whereDate('sale_date', '>=', $value)),
                AllowedFilter::callback('to', fn ($query, $value) => $query->whereDate('sale_date', '<=', $value)),
            )
            ->allowedSorts('sale_date', 'created_at', 'grand_total')
            ->with(['customer', 'warehouse', 'cashier'])
            ->defaultSort('-sale_date');

        if (! request()->user()->can('sales.view-all')) {
            $query->where('cashier_id', request()->user()->id);
        }

        $sales = $query->paginate(request()->integer('per_page', 20));

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
        $this->authorize('view', $sale);

        return new SaleResource($sale->load(['items.product', 'payments.cashAccount', 'customer', 'warehouse', 'cashier']));
    }

    public function invoicePdf(Sale $sale, \App\Support\SaleInvoicePdf $pdf)
    {
        $this->authorize('view', $sale);

        $sale->load(['items.product', 'payments.cashAccount', 'customer', 'warehouse', 'cashier']);

        $filename = 'sale-'.\Illuminate\Support\Str::slug($sale->invoice_number).'.pdf';

        return response($pdf->build($sale), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
        ]);
    }

    public function refund(RefundSaleRequest $request, Sale $sale, RefundSaleAction $refundSale): SaleResource
    {
        $refunded = $refundSale->execute($sale, $request->user()->id, $request->validated('items'));

        return new SaleResource($refunded->load(['warehouse', 'cashier']));
    }
}
