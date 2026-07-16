<?php

namespace App\Http\Requests\Inventory;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreStockAdjustmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('inventory.manage');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'product_id' => ['required', Rule::exists('products', 'id')],
            'warehouse_id' => ['required', Rule::exists('warehouses', 'id')],
            'quantity' => ['required', 'numeric', 'not_in:0'],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
            'reason' => ['required', 'string', 'max:255'],
        ];
    }
}
