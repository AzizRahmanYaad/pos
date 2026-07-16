<?php

namespace App\Http\Requests\Purchases;

use App\Models\Purchase;
use App\Models\PurchaseLandedCost;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePurchaseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Purchase::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'supplier_id' => ['required', Rule::exists('suppliers', 'id')],
            'warehouse_id' => ['required', Rule::exists('warehouses', 'id')],
            'purchase_date' => ['required', 'date'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'tax' => ['nullable', 'numeric', 'min:0'],

            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', Rule::exists('products', 'id')],
            'items.*.quantity' => ['required', 'numeric', 'min:0.0001'],
            'items.*.unit_id' => ['required', Rule::exists('units', 'id')],
            'items.*.unit_cost' => ['required', 'numeric', 'min:0'],
            'items.*.discount' => ['nullable', 'numeric', 'min:0'],
            'items.*.tax' => ['nullable', 'numeric', 'min:0'],

            'landed_costs' => ['nullable', 'array'],
            'landed_costs.*.description' => ['required_with:landed_costs', 'string', 'max:255'],
            'landed_costs.*.amount' => ['required_with:landed_costs', 'numeric', 'min:0'],
            'landed_costs.*.allocation_method' => [Rule::in([
                PurchaseLandedCost::METHOD_BY_VALUE, PurchaseLandedCost::METHOD_BY_QUANTITY,
            ])],
        ];
    }
}
