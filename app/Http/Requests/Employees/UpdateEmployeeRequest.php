<?php

namespace App\Http\Requests\Employees;

use App\Models\Employee;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateEmployeeRequest extends FormRequest
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
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:32'],
            'id_number' => ['nullable', 'string', 'max:64'],
            'designation' => ['nullable', 'string', 'max:255'],
            'salary_amount' => ['sometimes', 'required', 'numeric', 'min:0'],
            'salary_type' => ['sometimes', 'required', Rule::in([Employee::SALARY_MONTHLY, Employee::SALARY_DAILY])],
            'hire_date' => ['nullable', 'date'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
