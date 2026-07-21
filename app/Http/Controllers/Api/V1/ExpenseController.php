<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Expenses\Actions\CreateExpenseAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Expenses\StoreExpenseRequest;
use App\Http\Resources\ExpenseResource;
use App\Models\Expense;
use Illuminate\Http\Response;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class ExpenseController extends Controller
{
    public function index()
    {
        $this->authorize('viewAny', Expense::class);

        $expenses = $this->filtered()
            ->with(['category', 'cashAccount', 'purchase'])
            ->paginate(request()->integer('per_page', 25))
            ->withQueryString();

        return ExpenseResource::collection($expenses);
    }

    /**
     * A printable expenses summary for a date range: the grand total plus a
     * category-wise breakdown.
     */
    public function summary()
    {
        $this->authorize('viewAny', Expense::class);

        $expenses = $this->filtered()->with('category')->get();

        $categories = $expenses
            ->groupBy(fn (Expense $expense) => $expense->category?->name ?? '—')
            ->map(fn ($group) => [
                'category_name' => $group->first()->category?->name ?? '—',
                'count' => $group->count(),
                'total' => round((float) $group->sum('amount'), 2),
            ])
            ->sortByDesc('total')
            ->values();

        return response()->json([
            'data' => [
                'from' => request('from'),
                'to' => request('to'),
                'count' => $expenses->count(),
                'grand_total' => round((float) $expenses->sum('amount'), 2),
                'categories' => $categories,
            ],
        ]);
    }

    public function reportPdf(\App\Support\ExpenseReportPdf $pdf)
    {
        $this->authorize('viewAny', Expense::class);

        $expenses = $this->filtered()
            ->with('category')
            ->reorder('expense_date')
            ->orderBy('id')
            ->get();

        $filename = 'expenses-'.now()->format('Ymd').'.pdf';

        return response($pdf->build($expenses, request('from'), request('to')), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
        ]);
    }

    /**
     * Shared filtered query for the list, summary and PDF report so the three
     * always agree on which expenses fall inside the selected range.
     */
    private function filtered(): QueryBuilder
    {
        return QueryBuilder::for(Expense::class)
            ->allowedFilters(
                AllowedFilter::exact('expense_category_id'),
                AllowedFilter::exact('is_landed_cost'),
                AllowedFilter::exact('purchase_id'),
            )
            ->when(request('from'), fn ($query, $from) => $query->whereDate('expense_date', '>=', $from))
            ->when(request('to'), fn ($query, $to) => $query->whereDate('expense_date', '<=', $to))
            ->allowedSorts('expense_date', 'created_at', 'amount')
            ->defaultSort('-expense_date');
    }

    public function store(StoreExpenseRequest $request, CreateExpenseAction $createExpense): ExpenseResource
    {
        $expense = $createExpense->execute($request->validated(), $request->user()->id);

        return new ExpenseResource($expense);
    }

    public function destroy(Expense $expense): Response
    {
        $this->authorize('delete', $expense);

        $expense->delete();

        return response()->noContent();
    }
}
