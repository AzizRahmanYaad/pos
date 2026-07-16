<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Expenses\StoreExpenseCategoryRequest;
use App\Http\Resources\ExpenseCategoryResource;
use App\Models\ExpenseCategory;
use Illuminate\Http\Response;

class ExpenseCategoryController extends Controller
{
    public function index()
    {
        $this->authorize('viewAny', ExpenseCategory::class);

        return ExpenseCategoryResource::collection(ExpenseCategory::query()->orderBy('name')->get());
    }

    public function store(StoreExpenseCategoryRequest $request): ExpenseCategoryResource
    {
        return new ExpenseCategoryResource(ExpenseCategory::create($request->validated()));
    }

    public function destroy(ExpenseCategory $expenseCategory): Response
    {
        $this->authorize('delete', $expenseCategory);

        $expenseCategory->delete();

        return response()->noContent();
    }
}
