<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\BusinessSetting;
use App\Models\Customer;
use App\Models\Expense;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Models\ProductStock;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Supplier;
use App\Support\ListReportPdf;
use App\Support\ProfitLossPdf;
use App\Support\TenantContext;
use Carbon\Carbon;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function profitLoss(Request $request)
    {
        return response()->json($this->computeProfitLoss($request));
    }

    public function profitLossPdf(Request $request, ProfitLossPdf $pdf)
    {
        $filename = 'profit-loss-'.now()->format('Ymd').'.pdf';

        return response($pdf->build($this->computeProfitLoss($request)), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
        ]);
    }

    public function inventoryValuation()
    {
        $rows = $this->inventoryValuationRows();

        return response()->json([
            'rows' => $rows->values(),
            'total_value' => round($rows->sum('value'), 2),
        ]);
    }

    public function inventoryValuationPdf(ListReportPdf $pdf)
    {
        $sym = BusinessSetting::current()->currency_symbol ?: '';
        $money = fn ($v) => number_format((float) $v, 2).($sym ? ' '.$sym : '');
        $qty = fn ($v) => rtrim(rtrim(number_format((float) $v, 2), '0'), '.');

        $rows = $this->inventoryValuationRows();

        $columns = [
            ['label' => __('SKU'), 'width' => '14%'],
            ['label' => __('Product'), 'width' => '28%'],
            ['label' => __('Warehouse'), 'width' => '20%'],
            ['label' => __('Quantity'), 'align' => 'right', 'width' => '12%'],
            ['label' => __('Unit cost'), 'align' => 'right', 'width' => '13%'],
            ['label' => __('Total'), 'align' => 'right', 'width' => '13%'],
        ];

        $tableRows = $rows->map(fn ($r) => [
            $r['sku'] ?: '—', $r['product_name'], $r['warehouse_name'], $qty($r['quantity']), $money($r['average_cost']), $money($r['value']),
        ])->all();

        $filename = 'inventory-valuation-'.now()->format('Ymd').'.pdf';

        return response($pdf->build(
            __('Inventory Valuation'),
            $columns,
            $tableRows,
            __('Total').': '.$money($rows->sum('value')),
        ), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
        ]);
    }

    public function salesSummary(Request $request)
    {
        return response()->json(['rows' => $this->salesSummaryRows($request)]);
    }

    public function salesSummaryPdf(Request $request, ListReportPdf $pdf)
    {
        $sym = BusinessSetting::current()->currency_symbol ?: '';
        $money = fn ($v) => number_format((float) $v, 2).($sym ? ' '.$sym : '');

        [$from, $to] = $this->resolveRange($request);
        $rows = $this->salesSummaryRows($request);

        $columns = [
            ['label' => __('Period'), 'width' => '40%'],
            ['label' => __('Count'), 'align' => 'right', 'width' => '25%'],
            ['label' => __('Total'), 'align' => 'right', 'width' => '35%'],
        ];

        $tableRows = $rows->map(fn ($r) => [$r['period'], $r['sale_count'], $money($r['total'])])->all();

        $filename = 'sales-summary-'.now()->format('Ymd').'.pdf';

        return response($pdf->build(
            __('Sales Summary'),
            $columns,
            $tableRows,
            $from->toDateString().' — '.$to->toDateString().' • '.__('Total').': '.$money($rows->sum('total')),
        ), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
        ]);
    }

    public function expensesByCategory(Request $request)
    {
        return response()->json(['rows' => $this->expensesByCategoryRows($request)]);
    }

    public function expensesByCategoryPdf(Request $request, ListReportPdf $pdf)
    {
        $sym = BusinessSetting::current()->currency_symbol ?: '';
        $money = fn ($v) => number_format((float) $v, 2).($sym ? ' '.$sym : '');

        [$from, $to] = $this->resolveRange($request);
        $rows = $this->expensesByCategoryRows($request);

        $columns = [
            ['label' => __('Category'), 'width' => '60%'],
            ['label' => __('Total'), 'align' => 'right', 'width' => '40%'],
        ];

        $tableRows = $rows->map(fn ($r) => [$r['category'], $money($r['total'])])->all();

        $filename = 'expenses-by-category-'.now()->format('Ymd').'.pdf';

        return response($pdf->build(
            __('Expenses by Category'),
            $columns,
            $tableRows,
            $from->toDateString().' — '.$to->toDateString().' • '.__('Total').': '.$money($rows->sum('total')),
        ), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
        ]);
    }

    public function receivables()
    {
        $rows = $this->partyBalanceRows(Customer::class, positive: true);

        return response()->json(['rows' => $rows->values(), 'total' => round($rows->sum('balance'), 2)]);
    }

    public function receivablesPdf(ListReportPdf $pdf)
    {
        return $this->partyBalancePdf($pdf, Customer::class, positive: true, title: __('Receivables'), partyLabel: __('Customer'));
    }

    public function payables()
    {
        $rows = $this->partyBalanceRows(Supplier::class, positive: false);

        return response()->json(['rows' => $rows->values(), 'total' => round($rows->sum('balance'), 2)]);
    }

    public function payablesPdf(ListReportPdf $pdf)
    {
        return $this->partyBalancePdf($pdf, Supplier::class, positive: false, title: __('Payables'), partyLabel: __('Supplier'));
    }

    /**
     * @return array{from:string,to:string,revenue:float,cogs:float,gross_profit:float,operating_expenses:float,payroll_cost:float,net_profit:float}
     */
    private function computeProfitLoss(Request $request): array
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

        return [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'revenue' => round($revenue, 2),
            'cogs' => round($cogs, 2),
            'gross_profit' => round($grossProfit, 2),
            'operating_expenses' => round($operatingExpenses, 2),
            'payroll_cost' => round($payrollCost, 2),
            'net_profit' => round($netProfit, 2),
        ];
    }

    private function inventoryValuationRows()
    {
        return ProductStock::query()
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
    }

    private function salesSummaryRows(Request $request)
    {
        [$from, $to] = $this->resolveRange($request);
        $byMonth = $request->query('group_by') === 'month';

        return Sale::query()
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
    }

    private function expensesByCategoryRows(Request $request)
    {
        [$from, $to] = $this->resolveRange($request);

        return Expense::query()
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
    }

    /**
     * Every customer/supplier whose balance is on the requested side of
     * zero — a receivable (customer owes us) or a payable (we owe a
     * supplier) — sorted by the largest outstanding amount first.
     *
     * @param  class-string<Customer|Supplier>  $modelClass
     */
    private function partyBalanceRows(string $modelClass, bool $positive)
    {
        return $modelClass::query()
            ->get()
            ->map(fn ($party) => [
                'id' => $party->id,
                'name' => $party->name,
                'phone' => $party->phone,
                'balance' => round($positive ? (float) $party->currentBalance() : -(float) $party->currentBalance(), 2),
            ])
            ->filter(fn ($row) => $row['balance'] > 0.005)
            ->sortByDesc('balance')
            ->values();
    }

    /**
     * @param  class-string<Customer|Supplier>  $modelClass
     */
    private function partyBalancePdf(ListReportPdf $pdf, string $modelClass, bool $positive, string $title, string $partyLabel)
    {
        $sym = BusinessSetting::current()->currency_symbol ?: '';
        $money = fn ($v) => number_format((float) $v, 2).($sym ? ' '.$sym : '');

        $rows = $this->partyBalanceRows($modelClass, $positive);

        $columns = [
            ['label' => $partyLabel, 'width' => '45%'],
            ['label' => __('Phone'), 'width' => '25%'],
            ['label' => __('Balance'), 'align' => 'right', 'width' => '30%'],
        ];

        $tableRows = $rows->map(fn ($r) => [$r['name'], $r['phone'] ?: '—', $money($r['balance'])])->all();

        $filename = \Illuminate\Support\Str::slug($title).'-'.now()->format('Ymd').'.pdf';

        return response($pdf->build($title, $columns, $tableRows, __('Total').': '.$money($rows->sum('balance'))), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
        ]);
    }

    private function completedSaleItems(Carbon $from, Carbon $to)
    {
        return SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->when(TenantContext::id(), fn ($query, $tenantId) => $query->where('sales.tenant_id', $tenantId))
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
