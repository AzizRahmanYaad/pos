<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Inventory\Actions\ApplyAutoPricingAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Products\StoreProductRequest;
use App\Http\Requests\Products\UpdateProductRequest;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use Illuminate\Http\Response;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class ProductController extends Controller
{
    public function index()
    {
        $this->authorize('viewAny', Product::class);

        $products = QueryBuilder::for(Product::class)
            ->allowedFilters(
                AllowedFilter::partial('name'),
                AllowedFilter::partial('sku'),
                AllowedFilter::exact('barcode'),
                AllowedFilter::exact('category_id'),
                AllowedFilter::exact('is_active'),
                AllowedFilter::callback('search', function ($query, $value) {
                    $query->where(function ($query) use ($value) {
                        $query->where('name', 'like', "%{$value}%")
                            ->orWhere('sku', 'like', "%{$value}%")
                            ->orWhere('barcode', $value);
                    });
                }),
            )
            ->allowedSorts('name', 'sku', 'sale_price', 'created_at')
            ->with(['category', 'unit', 'stocks.warehouse'])
            ->defaultSort('name')
            ->paginate(request()->integer('per_page', 20));

        return ProductResource::collection($products);
    }

    public function listPdf(\App\Support\ListReportPdf $pdf)
    {
        $this->authorize('viewAny', Product::class);

        $products = Product::query()
            ->with(['category', 'unit', 'stocks'])
            ->when(request('search'), function ($query, $search) {
                $query->where(function ($query) use ($search) {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('sku', 'like', "%{$search}%")
                        ->orWhere('barcode', $search);
                });
            })
            ->orderBy('name')
            ->get();

        $sym = \App\Models\BusinessSetting::current()->currency_symbol ?: '';
        $money = fn ($v) => number_format((float) $v, 2).($sym ? ' '.$sym : '');
        $qty = fn ($v) => rtrim(rtrim(number_format((float) $v, 2), '0'), '.');

        $columns = [
            ['label' => __('Product'), 'width' => '32%'],
            ['label' => __('SKU'), 'width' => '16%'],
            ['label' => __('Category'), 'width' => '20%'],
            ['label' => __('Sale price'), 'align' => 'right', 'width' => '16%'],
            ['label' => __('Stock'), 'align' => 'right', 'width' => '16%'],
        ];

        $rows = $products->map(fn ($p) => [
            $p->name,
            $p->sku ?: '—',
            $p->category?->name ?: '—',
            $money($p->sale_price),
            $p->track_inventory ? $qty($p->stocks->sum('quantity')) : '—',
        ])->all();

        return response($pdf->build(__('Products'), $columns, $rows, __('Product catalogue')), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="products-'.now()->format('Ymd').'.pdf"',
        ]);
    }

    public function store(StoreProductRequest $request, ApplyAutoPricingAction $applyAutoPricing): ProductResource
    {
        $product = Product::create($request->validated());
        $applyAutoPricing->execute($product);

        return new ProductResource($product->load(['category', 'unit', 'stocks.warehouse']));
    }

    public function show(Product $product): ProductResource
    {
        $this->authorize('viewAny', Product::class);

        return new ProductResource($product->load(['category', 'unit', 'stocks.warehouse']));
    }

    public function update(UpdateProductRequest $request, Product $product, ApplyAutoPricingAction $applyAutoPricing): ProductResource
    {
        $product->update($request->validated());
        $applyAutoPricing->execute($product);

        return new ProductResource($product->load(['category', 'unit', 'stocks.warehouse']));
    }

    public function destroy(Product $product): Response
    {
        $this->authorize('delete', $product);

        $product->delete();

        return response()->noContent();
    }
}
