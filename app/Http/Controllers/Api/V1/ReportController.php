<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\BusinessSetting;
use App\Models\CashAccount;
use App\Models\Customer;
use App\Models\Expense;
use App\Models\LedgerEntry;
use App\Models\Payment;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Models\ProductStock;
use App\Models\Purchase;
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

    public function purchaseSummary(Request $request)
    {
        return response()->json(['rows' => $this->purchaseSummaryRows($request)]);
    }

    public function purchaseSummaryPdf(Request $request, ListReportPdf $pdf)
    {
        $sym = BusinessSetting::current()->currency_symbol ?: '';
        $money = fn ($v) => number_format((float) $v, 2).($sym ? ' '.$sym : '');

        [$from, $to] = $this->resolveRange($request);
        $rows = $this->purchaseSummaryRows($request);

        $columns = [
            ['label' => __('Period'), 'width' => '40%'],
            ['label' => __('Count'), 'align' => 'right', 'width' => '25%'],
            ['label' => __('Total'), 'align' => 'right', 'width' => '35%'],
        ];

        $tableRows = $rows->map(fn ($r) => [$r['period'], $r['purchase_count'], $money($r['total'])])->all();

        $filename = 'purchase-summary-'.now()->format('Ymd').'.pdf';

        return response($pdf->build(
            __('Purchase Summary'),
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

    public function dailyJournal(Request $request)
    {
        return response()->json($this->computeDailyJournal($request));
    }

    public function dailyJournalPdf(Request $request, ListReportPdf $pdf)
    {
        $sym = BusinessSetting::current()->currency_symbol ?: '';
        $money = fn ($v) => number_format((float) $v, 2).($sym ? ' '.$sym : '');

        $data = $this->computeDailyJournal($request);

        $typeLabels = [
            'sale' => __('Sale'),
            'purchase' => __('Purchase'),
            'customer_collection' => __('Collection'),
            'supplier_payment' => __('Supplier payment'),
            'expense' => __('Expense'),
        ];

        $columns = [
            ['label' => __('Time'), 'width' => '14%'],
            ['label' => __('Type'), 'width' => '16%'],
            ['label' => __('Description'), 'width' => '40%'],
            ['label' => __('Direction'), 'width' => '10%'],
            ['label' => __('Amount'), 'align' => 'right', 'width' => '20%'],
        ];

        $tableRows = collect($data['transactions'])->map(fn ($row) => [
            \Illuminate\Support\Carbon::parse($row['time'])->format('H:i'),
            $typeLabels[$row['type']] ?? $row['type'],
            $row['description'],
            $row['direction'] === 'in' ? __('In') : __('Out'),
            $money($row['amount']),
        ])->all();

        $subtitle = __('Sales').' '.$money($data['sales_total'])
            .' • '.__('Credit sales').' '.$money($data['credit_sales_total'])
            .' • '.__('Collections').' '.$money($data['customer_collections_total'])
            .' • '.__('Purchases').' '.$money($data['purchases_total'])
            .' • '.__('Supplier payments').' '.$money($data['supplier_payments_total'])
            .' • '.__('Expenses').' '.$money($data['expenses_total'])
            .' • '.__('Net cash movement').' '.$money($data['net_cash_movement'])
            .' • '.($data['profit_or_loss'] >= 0 ? __('Profit') : __('Loss')).' '.$money(abs($data['profit_or_loss']));

        $filename = 'daily-journal-'.$data['date'].'.pdf';

        return response($pdf->build(
            __('Daily Journal').' — '.$data['date'],
            $columns,
            $tableRows,
            $subtitle,
        ), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
        ]);
    }

    /**
     * A single day's complete financial activity: every sale, credit sale,
     * customer collection, purchase, supplier payment, and expense, plus
     * the day's net cash movement (read straight from the cash accounts'
     * ledger entries, so it always reconciles with the Cash Report) and a
     * same-day profit/loss figure.
     *
     * @return array{date:string,sales_total:float,credit_sales_total:float,customer_collections_total:float,purchases_total:float,supplier_payments_total:float,expenses_total:float,cash_in_total:float,cash_out_total:float,net_cash_movement:float,profit_or_loss:float,transactions:array<int,array{type:string,time:string,description:string,amount:float,direction:string}>}
     */
    private function computeDailyJournal(Request $request): array
    {
        $date = $request->query('date') ? Carbon::parse($request->query('date')) : Carbon::today();
        $start = $date->copy()->startOfDay();
        $end = $date->copy()->endOfDay();

        $saleItems = SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->when(TenantContext::id(), fn ($query, $tenantId) => $query->where('sales.tenant_id', $tenantId))
            ->whereIn('sales.status', [Sale::STATUS_COMPLETED, Sale::STATUS_PARTIALLY_REFUNDED])
            ->whereBetween('sales.sale_date', [$start, $end]);

        $salesTotal = (float) (clone $saleItems)
            ->selectRaw('COALESCE(SUM(sale_items.line_total * (sale_items.quantity - sale_items.refunded_quantity) / sale_items.quantity), 0) as total')
            ->value('total');
        $cogs = (float) (clone $saleItems)
            ->selectRaw('COALESCE(SUM((sale_items.quantity - sale_items.refunded_quantity) * sale_items.cost_price_snapshot), 0) as total')
            ->value('total');

        $sales = Sale::query()
            ->whereBetween('sale_date', [$start, $end])
            ->whereIn('status', [Sale::STATUS_COMPLETED, Sale::STATUS_PARTIALLY_REFUNDED, Sale::STATUS_REFUNDED])
            ->with('customer')
            ->get();
        $creditSalesTotal = (float) $sales->sum('due_amount');

        $purchases = Purchase::query()
            ->where('status', Purchase::STATUS_RECEIVED)
            ->whereBetween('purchase_date', [$start, $end])
            ->with('supplier')
            ->get();
        $purchasesTotal = (float) $purchases->sum('grand_total');

        $customerCollections = Payment::query()
            ->where('party_type', Customer::class)
            ->where('direction', Payment::DIRECTION_IN)
            ->whereBetween('paid_at', [$start, $end])
            ->with('party')
            ->get();
        $customerCollectionsTotal = (float) $customerCollections->sum('amount');

        $supplierPayments = Payment::query()
            ->where('party_type', Supplier::class)
            ->where('direction', Payment::DIRECTION_OUT)
            ->whereBetween('paid_at', [$start, $end])
            ->with('party')
            ->get();
        $supplierPaymentsTotal = (float) $supplierPayments->sum('amount');

        $expenses = Expense::query()
            ->whereBetween('expense_date', [$start, $end])
            ->with('category')
            ->get();
        $operatingExpensesTotal = (float) $expenses->where('is_landed_cost', false)->sum('amount');

        $cashMovements = LedgerEntry::query()
            ->where('ledgerable_type', CashAccount::class)
            ->whereBetween('transaction_date', [$start, $end])
            ->get();
        $cashIn = (float) $cashMovements->where('entry_type', LedgerEntry::DEBIT)->sum('amount');
        $cashOut = (float) $cashMovements->where('entry_type', LedgerEntry::CREDIT)->sum('amount');

        $transactions = collect()
            ->concat($sales->map(fn (Sale $sale) => [
                'type' => 'sale',
                'time' => $sale->sale_date,
                'description' => $sale->invoice_number.' — '.($sale->customer?->name ?? __('Walk-in')),
                'amount' => (float) $sale->grand_total,
                'direction' => 'in',
            ]))
            ->concat($purchases->map(fn (Purchase $purchase) => [
                'type' => 'purchase',
                'time' => $purchase->purchase_date,
                'description' => $purchase->purchase_number.($purchase->supplier ? ' — '.$purchase->supplier->name : ''),
                'amount' => (float) $purchase->grand_total,
                'direction' => 'out',
            ]))
            ->concat($customerCollections->map(fn (Payment $payment) => [
                'type' => 'customer_collection',
                'time' => $payment->paid_at,
                'description' => __('Collection from :name', ['name' => $payment->party?->name ?? '']),
                'amount' => (float) $payment->amount,
                'direction' => 'in',
            ]))
            ->concat($supplierPayments->map(fn (Payment $payment) => [
                'type' => 'supplier_payment',
                'time' => $payment->paid_at,
                'description' => __('Payment to :name', ['name' => $payment->party?->name ?? '']),
                'amount' => (float) $payment->amount,
                'direction' => 'out',
            ]))
            ->concat($expenses->map(fn (Expense $expense) => [
                'type' => 'expense',
                'time' => $expense->expense_date,
                'description' => $expense->category?->name ?? __('Expense'),
                'amount' => (float) $expense->amount,
                'direction' => 'out',
            ]))
            ->sortBy('time')
            ->values()
            ->map(fn ($row) => array_merge($row, ['time' => Carbon::parse($row['time'])->toDateTimeString()]));

        return [
            'date' => $date->toDateString(),
            'sales_total' => round($salesTotal, 2),
            'credit_sales_total' => round($creditSalesTotal, 2),
            'customer_collections_total' => round($customerCollectionsTotal, 2),
            'purchases_total' => round($purchasesTotal, 2),
            'supplier_payments_total' => round($supplierPaymentsTotal, 2),
            'expenses_total' => round($operatingExpensesTotal, 2),
            'cash_in_total' => round($cashIn, 2),
            'cash_out_total' => round($cashOut, 2),
            'net_cash_movement' => round($cashIn - $cashOut, 2),
            'profit_or_loss' => round($salesTotal - $cogs - $operatingExpensesTotal, 2),
            'transactions' => $transactions->values()->all(),
        ];
    }

    /**
     * @return array{from:string,to:string,revenue:float,cogs:float,gross_profit:float,operating_expenses:float,operating_expenses_by_category:array<int,array{category:string,total:float}>,payroll_cost:float,net_profit:float,cash_balance:float,inventory_value:float,receivables_total:float,payables_total:float}
     */
    private function computeProfitLoss(Request $request): array
    {
        [$from, $to] = $this->resolveRange($request);

        $revenue = (float) $this->completedSaleItems($from, $to)
            ->selectRaw('COALESCE(SUM(sale_items.line_total * (sale_items.quantity - sale_items.refunded_quantity) / sale_items.quantity), 0) as total')
            ->value('total');
        $cogs = (float) $this->completedSaleItems($from, $to)
            ->selectRaw('COALESCE(SUM((sale_items.quantity - sale_items.refunded_quantity) * sale_items.cost_price_snapshot), 0) as total')
            ->value('total');

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

        $grossProfit = $revenue - $cogs;
        $netProfit = $grossProfit - $operatingExpenses - $payrollCost;

        // A live balance-sheet snapshot alongside the period's P&L — cash,
        // inventory, receivables, and payables are always "as of right
        // now" (the same figures the dashboard shows), not tied to the
        // report's from/to range, since none of them are tracked
        // historically day-by-day.
        $cashBalance = CashAccount::query()->where('is_active', true)->get()
            ->sum(fn (CashAccount $account) => $account->currentBalance());

        $receivablesTotal = Customer::query()->get()
            ->sum(fn (Customer $customer) => max(0, $customer->currentBalance()));

        $payablesTotal = Supplier::query()->get()
            ->sum(fn (Supplier $supplier) => max(0, -$supplier->currentBalance()));

        $inventoryValue = (float) $this->inventoryValuationRows()->sum('value');

        return [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'revenue' => round($revenue, 2),
            'cogs' => round($cogs, 2),
            'gross_profit' => round($grossProfit, 2),
            'operating_expenses' => round($operatingExpenses, 2),
            'operating_expenses_by_category' => $expensesByCategory->all(),
            'payroll_cost' => round($payrollCost, 2),
            'net_profit' => round($netProfit, 2),
            'cash_balance' => round($cashBalance, 2),
            'inventory_value' => round($inventoryValue, 2),
            'receivables_total' => round($receivablesTotal, 2),
            'payables_total' => round($payablesTotal, 2),
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

    /**
     * Per-sale net totals (grand_total minus whatever was returned),
     * grouped by day or month — a partially refunded sale contributes only
     * what's left of it, and a fully refunded one contributes nothing.
     */
    private function salesSummaryRows(Request $request)
    {
        [$from, $to] = $this->resolveRange($request);
        $byMonth = $request->query('group_by') === 'month';

        return $this->completedSaleItems($from, $to)
            ->selectRaw('sales.id as sale_id, sales.sale_date as sale_date, SUM(sale_items.line_total * (sale_items.quantity - sale_items.refunded_quantity) / sale_items.quantity) as net_total')
            ->groupBy('sales.id', 'sales.sale_date')
            ->get()
            ->groupBy(fn ($row) => Carbon::parse($row->sale_date)->format($byMonth ? 'Y-m' : 'Y-m-d'))
            ->map(fn ($rows, $period) => [
                'period' => $period,
                'sale_count' => $rows->count(),
                'total' => round((float) $rows->sum('net_total'), 2),
            ])
            ->sortBy('period')
            ->values();
    }

    /**
     * Received purchases (grand_total, which already includes landed
     * costs) grouped by day or month — drafts aren't yet real spend and
     * cancelled purchases never happened, so both are excluded.
     */
    private function purchaseSummaryRows(Request $request)
    {
        [$from, $to] = $this->resolveRange($request);
        $byMonth = $request->query('group_by') === 'month';

        return Purchase::query()
            ->when(TenantContext::id(), fn ($query, $tenantId) => $query->where('tenant_id', $tenantId))
            ->where('status', Purchase::STATUS_RECEIVED)
            ->whereBetween('purchase_date', [$from, $to])
            ->get(['id', 'purchase_date', 'grand_total'])
            ->groupBy(fn ($row) => Carbon::parse($row->purchase_date)->format($byMonth ? 'Y-m' : 'Y-m-d'))
            ->map(fn ($rows, $period) => [
                'period' => $period,
                'purchase_count' => $rows->count(),
                'total' => round((float) $rows->sum('grand_total'), 2),
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

    /**
     * Sale items belonging to a sale that still has real revenue in it —
     * completed sales and partially refunded ones (whatever wasn't
     * returned still counts). Fully refunded sales are excluded entirely.
     * Callers must weigh line_total/quantity by the item's own
     * (quantity - refunded_quantity) so a partial return nets out exactly
     * the returned share, not the whole line.
     */
    private function completedSaleItems(Carbon $from, Carbon $to)
    {
        return SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->when(TenantContext::id(), fn ($query, $tenantId) => $query->where('sales.tenant_id', $tenantId))
            ->whereIn('sales.status', [Sale::STATUS_COMPLETED, Sale::STATUS_PARTIALLY_REFUNDED])
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
