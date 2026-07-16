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

        $expenses = QueryBuilder::for(Expense::class)
            ->allowedFilters(
                AllowedFilter::exact('expense_category_id'),
                AllowedFilter::exact('is_landed_cost'),
                AllowedFilter::exact('purchase_id'),
            )
            ->allowedSorts('expense_date', 'created_at', 'amount')
            ->with(['category', 'cashAccount', 'purchase'])
            ->defaultSort('-expense_date')
            ->paginate(request()->integer('per_page', 25));

        return ExpenseResource::collection($expenses);
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
