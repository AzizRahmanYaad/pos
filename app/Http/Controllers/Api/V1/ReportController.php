<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Models\ProductStock;
use App\Models\Sale;
use App\Models\SaleItem;
use Carbon\Carbon;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function profitLoss(Request $request)
    {
        [$from, $to] = $this->resolveRange($request);

        $revenue = (float) $this->completedSaleItems($from, $to)->sum('sale_items.line_total');
        $cogs = (float) $this->completedSaleItems($from, $to)
            ->selectRaw('COALESCE(SUM(sale_items.quantity * sale_items.cost_price_snapshot), 0) as total')
            ->value('total');

        $operatingExpenses = (float) Expense::query()
            ->whereBetween('expense_date', [$from, $to])
            ->where('is_landed_cost', false)
            ->sum('amount');

        $payrollCost = (float) PayrollItem::query()
            ->whereHas('payrollRun', function ($query) use ($from, $to) {
                $query->where('status', PayrollRun::STATUS_PAID)->whereBetween('paid_at', [$from, $to]);
            })
            ->sum('net_pay');

        $grossProfit = $revenue - $cogs;
        $netProfit = $grossProfit - $operatingExpenses - $payrollCost;

        return response()->json([
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'revenue' => round($revenue, 2),
            'cogs' => round($cogs, 2),
            'gross_profit' => round($grossProfit, 2),
            'operating_expenses' => round($operatingExpenses, 2),
            'payroll_cost' => round($payrollCost, 2),
            'net_profit' => round($netProfit, 2),
        ]);
    }

    public function inventoryValuation()
    {
        $rows = ProductStock::query()
            ->with(['product', 'warehouse'])
            ->where('quantity', '>', 0)
            ->get()
            ->map(fn (ProductStock $stock) => [
                'product_id' => $stock->product_id,
                'product_name' => $stock->product?->name,
                'sku' => $stock->product?->sku,
                'warehouse_id' => $stock->warehouse_id,
                'warehouse_name' => $stock->warehouse?->name,
                'quantity' => (float) $stock->quantity,
                'average_cost' => (float) $stock->average_cost,
                'value' => round((float) $stock->quantity * (float) $stock->average_cost, 2),
            ]);

        return response()->json([
            'rows' => $rows->values(),
            'total_value' => round($rows->sum('value'), 2),
        ]);
    }

    public function salesSummary(Request $request)
    {
        [$from, $to] = $this->resolveRange($request);
        $byMonth = $request->query('group_by') === 'month';

        $rows = Sale::query()
            ->where('status', Sale::STATUS_COMPLETED)
            ->whereBetween('sale_date', [$from, $to])
            ->get(['sale_date', 'grand_total'])
            ->groupBy(fn (Sale $sale) => $sale->sale_date->format($byMonth ? 'Y-m' : 'Y-m-d'))
            ->map(fn ($sales, $period) => [
                'period' => $period,
                'sale_count' => $sales->count(),
                'total' => round((float) $sales->sum('grand_total'), 2),
            ])
            ->sortBy('period')
            ->values();

        return response()->json(['rows' => $rows]);
    }

    public function expensesByCategory(Request $request)
    {
        [$from, $to] = $this->resolveRange($request);

        $rows = Expense::query()
            ->join('expense_categories', 'expense_categories.id', '=', 'expenses.expense_category_id')
            ->whereBetween('expense_date', [$from, $to])
            ->selectRaw('expense_categories.name as category, SUM(expenses.amount) as total')
            ->groupBy('expense_categories.name')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'category' => $row->category,
                'total' => round((float) $row->total, 2),
            ]);

        return response()->json(['rows' => $rows]);
    }

    private function completedSaleItems(Carbon $from, Carbon $to)
    {
        return SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.status', Sale::STATUS_COMPLETED)
            ->whereBetween('sales.sale_date', [$from, $to]);
    }

    private function resolveRange(Request $request): array
    {
        $from = $request->query('from')
            ? Carbon::parse($request->query('from'))->startOfDay()
            : Carbon::now()->startOfMonth();

        $to = $request->query('to')
            ? Carbon::parse($request->query('to'))->endOfDay()
            : Carbon::now()->endOfDay();

        return [$from, $to];
    }
}
