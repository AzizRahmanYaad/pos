<?php

namespace App\Http\Requests\Parties;

use App\Models\CashAccount;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCashAccountRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('cash_account'));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'type' => ['sometimes', 'required', Rule::in([
                CashAccount::TYPE_CASH, CashAccount::TYPE_BANK, CashAccount::TYPE_MOBILE_WALLET,
            ])],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
