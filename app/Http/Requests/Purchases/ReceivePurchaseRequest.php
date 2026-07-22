<?php

namespace App\Http\Requests\Purchases;

use App\Models\SalePayment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReceivePurchaseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('purchase'));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'payment' => ['nullable', 'array'],
            'payment.amount' => ['nullable', 'numeric', 'min:0.01'],
            'payment.cash_account_id' => ['required_with:payment.amount', Rule::exists('cash_accounts', 'id')],
            'payment.method' => ['nullable', Rule::in([
                SalePayment::METHOD_CASH, SalePayment::METHOD_CARD,
                SalePayment::METHOD_MOBILE_WALLET, SalePayment::METHOD_BANK,
            ])],
            'payment.description' => ['nullable', 'string', 'max:255'],
        ];
    }
}
