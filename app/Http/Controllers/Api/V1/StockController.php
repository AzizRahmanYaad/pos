<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;

class StockController extends Controller
{
    /**
     * Every tracked product's available stock, per warehouse and in total,
     * with reorder status — optionally filtered by search, warehouse, or
     * stock status (low / out of stock).
     */
    public function index(Request $request)
    {
        abort_unless($request->user()->can('inventory.manage'), 403);

        $warehouseId = $request->integer('warehouse_id') ?: null;
        $status = $request->string('status')->toString();

        $products = Product::query()
            ->where('track_inventory', true)
            ->with(['category', 'unit', 'stocks.warehouse'])
            ->when($request->filled('search'), function ($query) use ($request) {
                $search = $request->string('search');
                $query->where(function ($query) use ($search) {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('sku', 'like', "%{$search}%")
                        ->orWhere('barcode', $search);
                });
            })
            ->when($warehouseId, fn ($query) => $query->whereHas('stocks', fn ($q) => $q->where('warehouse_id', $warehouseId)))
            ->orderBy('name')
            ->get()
            ->map(fn (Product $product) => $this->summarize($product, $warehouseId))
            ->when(in_array($status, ['low', 'out'], true), fn ($rows) => $rows->where('status', $status))
            ->when($status === 'reorder', fn ($rows) => $rows->whereIn('status', ['low', 'out']))
            ->values();

        return response()->json(['data' => $products]);
    }

    /**
     * Headline counts for the Stocks page: how many tracked products,
     * how many need reordering, and the value of everything on hand.
     */
    public function summary(Request $request)
    {
        abort_unless($request->user()->can('inventory.manage'), 403);

        $products = Product::query()->where('track_inventory', true)->with('stocks')->get();

        $lowCount = 0;
        $outCount = 0;
        $totalValue = 0.0;

        foreach ($products as $product) {
            $total = (float) $product->stocks->sum('quantity');
            $totalValue += $product->stocks->sum(fn ($s) => (float) $s->quantity * (float) $s->average_cost);

            if ($total <= 0) {
                $outCount++;
            } elseif ($total <= (float) $product->reorder_level) {
                $lowCount++;
            }
        }

        return response()->json([
            'data' => [
                'tracked_products' => $products->count(),
                'low_stock_count' => $lowCount,
                'out_of_stock_count' => $outCount,
                'total_stock_value' => round($totalValue, 2),
            ],
        ]);
    }

    /**
     * A capped list of products that need reordering — powers the
     * notification bell so it stays cheap to poll.
     */
    public function alerts(Request $request)
    {
        abort_unless($request->user()->can('inventory.manage'), 403);

        $products = Product::query()
            ->where('track_inventory', true)
            ->where('is_active', true)
            ->with('stocks')
            ->get()
            ->map(fn (Product $product) => $this->summarize($product))
            ->filter(fn ($row) => $row['status'] !== 'ok')
            ->sortBy(fn ($row) => $row['status'] === 'out' ? 0 : 1)
            ->take(20)
            ->values();

        return response()->json(['data' => $products]);
    }

    /**
     * @return array<string, mixed>
     */
    private function summarize(Product $product, ?int $warehouseId = null): array
    {
        $stocks = $warehouseId
            ? $product->stocks->where('warehouse_id', $warehouseId)
            : $product->stocks;

        $total = (float) $stocks->sum('quantity');
        $reorder = (float) $product->reorder_level;
        $status = $total <= 0 ? 'out' : ($total <= $reorder ? 'low' : 'ok');

        return [
            'id' => $product->id,
            'sku' => $product->sku,
            'name' => $product->name,
            'category_name' => $product->category?->name,
            'unit_short_name' => $product->unit?->short_name,
            'reorder_level' => $reorder,
            'total_stock' => $total,
            'status' => $status,
            'stock_value' => round($stocks->sum(fn ($s) => (float) $s->quantity * (float) $s->average_cost), 2),
            'warehouses' => $product->stocks->map(fn ($s) => [
                'warehouse_id' => $s->warehouse_id,
                'warehouse_name' => $s->warehouse?->name,
                'quantity' => (float) $s->quantity,
            ])->values(),
        ];
    }
}
