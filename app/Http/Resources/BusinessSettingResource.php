<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BusinessSettingResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'company_name' => $this->company_name,
            'address' => $this->address,
            'phone' => $this->phone,
            'email' => $this->email,
            'logo_path' => $this->logo_path,
            'currency_code' => $this->currency_code,
            'currency_symbol' => $this->currency_symbol,
            'default_locale' => $this->default_locale,
            'fiscal_year_start_month' => $this->fiscal_year_start_month,
            'invoice_prefix' => $this->invoice_prefix,
            'purchase_prefix' => $this->purchase_prefix,
            'receipt_footer' => $this->receipt_footer,
            'default_tax_rate' => (float) $this->default_tax_rate,
            'auto_close_daily' => $this->auto_close_daily,
        ];
    }
}
