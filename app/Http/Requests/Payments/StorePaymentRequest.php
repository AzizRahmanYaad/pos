<?php

namespace App\Http\Requests\Payments;

use App\Models\Payment;
use App\Models\SalePayment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Payment::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'party_type' => ['required', Rule::in(['customer', 'supplier'])],
            'party_id' => ['required', Rule::exists(
                $this->input('party_type') === 'customer' ? 'customers' : 'suppliers',
                'id',
            )],
            'direction' => ['required', Rule::in([Payment::DIRECTION_IN, Payment::DIRECTION_OUT])],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'cash_account_id' => ['required', Rule::exists('cash_accounts', 'id')],
            'method' => ['required', Rule::in([
                SalePayment::METHOD_CASH, SalePayment::METHOD_CARD,
                SalePayment::METHOD_MOBILE_WALLET, SalePayment::METHOD_BANK,
            ])],
            'description' => ['nullable', 'string', 'max:255'],
            'paid_at' => ['nullable', 'date'],

            'reference_type' => ['nullable', Rule::in(['sale', 'purchase'])],
            'reference_id' => ['nullable', 'required_with:reference_type', Rule::exists(
                $this->input('reference_type') === 'sale' ? 'sales' : 'purchases',
                'id',
            )],
        ];
    }
}
