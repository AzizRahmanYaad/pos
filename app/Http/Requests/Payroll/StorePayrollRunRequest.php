<?php

namespace App\Http\Requests\Payroll;

use App\Models\PayrollRun;
use Illuminate\Foundation\Http\FormRequest;

class StorePayrollRunRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', PayrollRun::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'period_month' => ['required', 'integer', 'between:1,12'],
            'period_year' => ['required', 'integer', 'between:2000,2100'],
        ];
    }
}
