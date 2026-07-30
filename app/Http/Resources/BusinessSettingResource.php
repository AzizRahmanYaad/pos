<?php

namespace App\Http\Resources;

use App\Models\BusinessSetting;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BusinessSettingResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        // The fields a business must have something in are never sent as
        // null, whatever state the row is in. The screen sends this object
        // straight back when it saves, and a null here comes back as "the
        // currency code field is required" against a form the shopkeeper
        // only opened to change the company name.
        $defaults = BusinessSetting::defaults();
        $held = fn (string $field) => $this->{$field} ?? $defaults[$field];

        return [
            'company_name' => $held('company_name'),
            'address' => $this->address,
            'phone' => $this->phone,
            'email' => $this->email,
            'logo_path' => $this->logo_path,
            'currency_code' => $held('currency_code'),
            'currency_symbol' => $held('currency_symbol'),
            'default_locale' => $held('default_locale'),
            'fiscal_year_start_month' => (int) $held('fiscal_year_start_month'),
            'invoice_prefix' => $held('invoice_prefix'),
            'purchase_prefix' => $held('purchase_prefix'),
            'receipt_footer' => $this->receipt_footer,
            'default_tax_rate' => (float) $held('default_tax_rate'),
            'auto_close_daily' => (bool) $held('auto_close_daily'),
        ];
    }
}
