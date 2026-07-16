<?php

namespace App\Http\Requests\Parties;

use App\Models\CashAccount;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCashAccountRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', CashAccount::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', Rule::in([
                CashAccount::TYPE_CASH, CashAccount::TYPE_BANK, CashAccount::TYPE_MOBILE_WALLET,
            ])],
            'opening_balance' => ['numeric'],
            'is_active' => ['boolean'],
        ];
    }
}
