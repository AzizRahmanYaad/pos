<?php

namespace App\Http\Requests\Expenses;

use App\Models\ExpenseCategory;
use Illuminate\Foundation\Http\FormRequest;

class StoreExpenseCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', ExpenseCategory::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'is_landed_cost_type' => ['boolean'],
        ];
    }
}
