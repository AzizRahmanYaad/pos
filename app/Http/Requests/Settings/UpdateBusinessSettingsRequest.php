<?php

namespace App\Http\Requests\Settings;

use App\Http\Middleware\SetLocale;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateBusinessSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('settings.manage');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'company_name' => ['sometimes', 'required', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:32'],
            'email' => ['nullable', 'email', 'max:255'],
            'currency_code' => ['sometimes', 'required', 'string', 'max:8'],
            'currency_symbol' => ['sometimes', 'required', 'string', 'max:8'],
            'default_locale' => ['sometimes', 'required', Rule::in(SetLocale::SUPPORTED_LOCALES)],
            'fiscal_year_start_month' => ['sometimes', 'required', 'integer', 'between:1,12'],
            'invoice_prefix' => ['sometimes', 'required', 'string', 'max:16'],
            'purchase_prefix' => ['sometimes', 'required', 'string', 'max:16'],
            'receipt_footer' => ['nullable', 'string'],
            'default_tax_rate' => ['sometimes', 'required', 'numeric', 'min:0', 'max:100'],
            'auto_close_daily' => ['sometimes', 'boolean'],
        ];
    }
}
