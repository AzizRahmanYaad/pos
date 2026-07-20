<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\SaleResource;
use App\Models\CashAccount;
use App\Models\Customer;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Supplier;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:pos.access');
    }

    public function summary()
    {
        $user = auth()->user();
        if (!$user || !$user->organization_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $today = now()->startOfDay();
        $todaySales = Sale::query()
            ->where('status', Sale::STATUS_COMPLETED)
            ->whereDate('sale_date', $today);

        $todaySalesTotal = (float) (clone $todaySales)->sum('grand_total');
        $todaySalesCount = (clone $todaySales)->count();

        $todayCogs = (float) SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.status', Sale::STATUS_COMPLETED)
            ->whereDate('sales.sale_date', $today)
            ->selectRaw('COALESCE(SUM(sale_items.quantity * sale_items.cost_price_snapshot), 0) as total')
            ->value('total');

        $todayProfit = $todaySalesTotal - $todayCogs;

        $lowStock = DB::table('product_stocks')
            ->join('products', 'products.id', '=', 'product_stocks.product_id')
            ->where('products.track_inventory', true)
            ->where('products.is_active', true)
            ->groupBy('products.id', 'products.reorder_level')
            ->havingRaw('SUM(product_stocks.quantity) <= products.reorder_level')
            ->select('products.id')
            ->get();

        $topProducts = DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->join('products', 'products.id', '=', 'sale_items.product_id')
            ->where('sales.status', Sale::STATUS_COMPLETED)
            ->where('sales.sale_date', '>=', now()->subDays(30))
            ->groupBy('products.id', 'products.name')
            ->orderByDesc(DB::raw('SUM(sale_items.line_total)'))
            ->limit(5)
            ->select('products.id', 'products.name', DB::raw('SUM(sale_items.quantity) as quantity_sold'), DB::raw('SUM(sale_items.line_total) as revenue'))
            ->get()
            ->map(fn ($row) => [
                'product_id' => $row->id,
                'name' => $row->name,
                'quantity_sold' => (float) $row->quantity_sold,
                'revenue' => round((float) $row->revenue, 2),
            ]);

        $cashPosition = CashAccount::query()->where('is_active', true)->get()
            ->sum(fn (CashAccount $account) => $account->currentBalance());

        $receivables = Customer::query()->get()
            ->sum(fn (Customer $customer) => max(0, $customer->currentBalance()));

        $payables = Supplier::query()->get()
            ->sum(fn (Supplier $supplier) => max(0, -$supplier->currentBalance()));

        $recentSales = Sale::query()
            ->with(['customer', 'cashier'])
            ->where('status', Sale::STATUS_COMPLETED)
            ->latest('sale_date')
            ->limit(5)
            ->get();

        return response()->json([
            'today_sales' => round($todaySalesTotal, 2),
            'today_sales_count' => $todaySalesCount,
            'today_profit' => round($todayProfit, 2),
            'low_stock_count' => $lowStock->count(),
            'top_products' => $topProducts,
            'cash_position' => round($cashPosition, 2),
            'receivables' => round($receivables, 2),
            'payables' => round($payables, 2),
            'recent_sales' => SaleResource::collection($recentSales),
        ]);
    }
}
