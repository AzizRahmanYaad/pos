<?php

namespace App\Http\Requests\Employees;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreEmployeeAdvanceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('employee'));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'amount' => ['required', 'numeric', 'min:0.01'],
            'cash_account_id' => ['required', Rule::exists('cash_accounts', 'id')],
            'reason' => ['nullable', 'string', 'max:255'],
        ];
    }
}
