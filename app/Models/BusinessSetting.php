<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'company_name', 'address', 'phone', 'email', 'logo_path',
    'currency_code', 'currency_symbol', 'default_locale',
    'fiscal_year_start_month', 'invoice_prefix', 'purchase_prefix',
    'receipt_footer', 'default_tax_rate', 'auto_close_daily',
])]
class BusinessSetting extends Model
{
    protected function casts(): array
    {
        return [
            'default_tax_rate' => 'decimal:2',
            'auto_close_daily' => 'boolean',
        ];
    }

    /**
     * The app has exactly one settings row; get it, creating the default
     * row on first access.
     */
    public static function current(): self
    {
        return static::query()->firstOrCreate(['id' => 1]);
    }
}
