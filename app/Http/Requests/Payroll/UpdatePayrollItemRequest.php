<?php

namespace App\Http\Requests\Payroll;

use App\Models\PayrollRun;
use Illuminate\Foundation\Http\FormRequest;

class UpdatePayrollItemRequest extends FormRequest
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
            'bonuses' => ['required', 'numeric', 'min:0'],
            'other_deductions' => ['required', 'numeric', 'min:0'],
        ];
    }
}
