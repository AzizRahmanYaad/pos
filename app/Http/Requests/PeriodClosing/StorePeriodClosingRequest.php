<?php

namespace App\Http\Requests\PeriodClosing;

use App\Models\PeriodClosing;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePeriodClosingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', PeriodClosing::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'period_type' => ['required', Rule::in([
                PeriodClosing::TYPE_DAILY, PeriodClosing::TYPE_MONTHLY, PeriodClosing::TYPE_CUSTOM,
            ])],
            'period_start' => ['required', 'date'],
            'period_end' => ['required', 'date', 'after_or_equal:period_start'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
