<?php

namespace App\Http\Requests\Expenses;

use App\Models\Expense;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreExpenseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Expense::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'expense_category_id' => ['required', Rule::exists('expense_categories', 'id')],
            'warehouse_id' => ['nullable', Rule::exists('warehouses', 'id')],
            'cash_account_id' => ['required', Rule::exists('cash_accounts', 'id')],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'expense_date' => ['nullable', 'date'],
            'paid_to' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'is_landed_cost' => ['boolean'],
            'purchase_id' => ['nullable', 'required_if:is_landed_cost,true', Rule::exists('purchases', 'id')],
        ];
    }
}
