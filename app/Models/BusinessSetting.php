<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
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
    use BelongsToTenant;

    protected function casts(): array
    {
        return [
            'default_tax_rate' => 'decimal:2',
            'auto_close_daily' => 'boolean',
        ];
    }

    /**
     * Each tenant (business) has exactly one settings row; get the current
     * tenant's row, creating the default row on first access. The tenant
     * scope on this model narrows the lookup, and the creating hook stamps
     * the tenant on the new row.
     */
    public static function current(): self
    {
        return static::query()->firstOrCreate([]);
    }
}
