<?php

namespace App\Http\Requests\Parties;

use App\Models\Customer;
use App\Models\LedgerEntry;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCustomerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Customer::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:32'],
            'address' => ['nullable', 'string', 'max:255'],
            'opening_balance' => ['numeric', 'min:0'],
            'opening_balance_type' => [Rule::in([LedgerEntry::DEBIT, LedgerEntry::CREDIT])],
            'credit_limit' => ['numeric', 'min:0'],
            'is_active' => ['boolean'],
        ];
    }
}
