<?php

namespace App\Http\Controllers\Api\V1;

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
            )
            ->allowedSorts('name', 'sku', 'sale_price', 'created_at')
            ->with(['category', 'unit', 'stocks.warehouse'])
            ->defaultSort('name')
            ->paginate(request()->integer('per_page', 20));

        return ProductResource::collection($products);
    }

    public function store(StoreProductRequest $request): ProductResource
    {
        $product = Product::create($request->validated());

        return new ProductResource($product->load(['category', 'unit', 'stocks.warehouse']));
    }

    public function show(Product $product): ProductResource
    {
        $this->authorize('viewAny', Product::class);

        return new ProductResource($product->load(['category', 'unit', 'stocks.warehouse']));
    }

    public function update(UpdateProductRequest $request, Product $product): ProductResource
    {
        $product->update($request->validated());

        return new ProductResource($product->load(['category', 'unit', 'stocks.warehouse']));
    }

    public function destroy(Product $product): Response
    {
        $this->authorize('delete', $product);

        $product->delete();

        return response()->noContent();
    }
}
