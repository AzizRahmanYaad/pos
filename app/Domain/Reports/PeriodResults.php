<?php

namespace App\Domain\Reports;

use App\Models\Expense;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Models\Purchase;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Support\TenantContext;
use Carbon\Carbon;

/**
 * What a stretch of trading actually earned, in one place.
 *
 * The profit-and-loss report and a closed period answer the same question
 * about the same dates, and a shopkeeper comparing the two has every right
 * to expect the same number twice. Two copies of this arithmetic would
 * eventually disagree — one gets a fix the other misses — and the day that
 * happens is the day neither figure can be trusted.
 */
class PeriodResults
{
    /**
     * @return array{revenue:float,discounts:float,net_revenue:float,cogs:float,gross_profit:float,operating_expenses:float,operating_expenses_by_category:array<int,array{category:string,total:float}>,payroll_cost:float,net_profit:float,purchases_total:float,sales_count:int}
     */
    public function forRange(Carbon $from, Carbon $to): array
    {
        $revenue = (float) $this->completedSaleItems($from, $to)
            ->selectRaw('COALESCE(SUM(sale_items.line_total * (sale_items.quantity - sale_items.refunded_quantity) / sale_items.quantity), 0) as total')
            ->value('total');

        $cogs = (float) $this->completedSaleItems($from, $to)
            ->selectRaw('COALESCE(SUM((sale_items.quantity - sale_items.refunded_quantity) * sale_items.cost_price_snapshot), 0) as total')
            ->value('total');

        // Line totals already carry any discount given on the line itself,
        // but a discount taken off the whole sale at the till never reached
        // this figure — so revenue was reported as if it had been charged in
        // full. It is money the shop chose not to take, and it belongs here
        // beside the expenses rather than hidden inside the takings.
        $discounts = (float) Sale::query()
            ->when(TenantContext::id(), fn ($query, $tenantId) => $query->where('sales.tenant_id', $tenantId))
            ->whereIn('status', [Sale::STATUS_COMPLETED, Sale::STATUS_PARTIALLY_REFUNDED])
            ->whereBetween('sale_date', [$from, $to])
            ->sum('discount');

        $expensesByCategory = Expense::query()
            ->join('expense_categories', 'expense_categories.id', '=', 'expenses.expense_category_id')
            ->whereBetween('expense_date', [$from, $to])
            ->where('is_landed_cost', false)
            ->selectRaw('expense_categories.name as category, SUM(expenses.amount) as total')
            ->groupBy('expense_categories.name')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => ['category' => $row->category, 'total' => round((float) $row->total, 2)])
            ->values();

        $operatingExpenses = (float) $expensesByCategory->sum('total');

        $payrollCost = (float) PayrollItem::query()
            ->whereHas('payrollRun', function ($query) use ($from, $to) {
                $query->where('status', PayrollRun::STATUS_PAID)->whereBetween('paid_at', [$from, $to]);
            })
            ->sum('net_pay');

        $purchasesTotal = (float) Purchase::query()
            ->where('status', Purchase::STATUS_RECEIVED)
            ->whereBetween('purchase_date', [$from, $to])
            ->sum('grand_total');

        $salesCount = Sale::query()
            ->whereIn('status', [Sale::STATUS_COMPLETED, Sale::STATUS_PARTIALLY_REFUNDED])
            ->whereBetween('sale_date', [$from, $to])
            ->count();

        $netRevenue = $revenue - $discounts;
        $grossProfit = $netRevenue - $cogs;
        $netProfit = $grossProfit - $operatingExpenses - $payrollCost;

        return [
            'revenue' => round($revenue, 2),
            'discounts' => round($discounts, 2),
            'net_revenue' => round($netRevenue, 2),
            'cogs' => round($cogs, 2),
            'gross_profit' => round($grossProfit, 2),
            'operating_expenses' => round($operatingExpenses, 2),
            'operating_expenses_by_category' => $expensesByCategory->all(),
            'payroll_cost' => round($payrollCost, 2),
            'net_profit' => round($netProfit, 2),
            'purchases_total' => round($purchasesTotal, 2),
            'sales_count' => $salesCount,
        ];
    }

    private function completedSaleItems(Carbon $from, Carbon $to)
    {
        return SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->when(TenantContext::id(), fn ($query, $tenantId) => $query->where('sales.tenant_id', $tenantId))
            ->whereIn('sales.status', [Sale::STATUS_COMPLETED, Sale::STATUS_PARTIALLY_REFUNDED])
            ->whereBetween('sales.sale_date', [$from, $to]);
    }
}
