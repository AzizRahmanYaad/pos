<?php

namespace App\Http\Requests\Payroll;

use App\Models\PayrollRun;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PayPayrollRunRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', PayrollRun::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'cash_account_id' => ['required', Rule::exists('cash_accounts', 'id')],
        ];
    }
}
