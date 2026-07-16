<?php

namespace App\Http\Requests\Sales;

use App\Models\Sale;
use App\Models\SalePayment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSaleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Sale::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'customer_id' => ['nullable', Rule::exists('customers', 'id')],
            'warehouse_id' => ['required', Rule::exists('warehouses', 'id')],
            'sale_date' => ['nullable', 'date'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'tax' => ['nullable', 'numeric', 'min:0'],

            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', Rule::exists('products', 'id')],
            'items.*.quantity' => ['required', 'numeric', 'min:0.0001'],
            'items.*.unit_id' => ['required', Rule::exists('units', 'id')],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.discount' => ['nullable', 'numeric', 'min:0'],
            'items.*.tax' => ['nullable', 'numeric', 'min:0'],

            'payments' => ['array'],
            'payments.*.cash_account_id' => ['required_with:payments', Rule::exists('cash_accounts', 'id')],
            'payments.*.method' => ['required_with:payments', Rule::in([
                SalePayment::METHOD_CASH, SalePayment::METHOD_CARD,
                SalePayment::METHOD_MOBILE_WALLET, SalePayment::METHOD_BANK,
            ])],
            'payments.*.amount' => ['required_with:payments', 'numeric', 'min:0.01'],
        ];
    }
}
