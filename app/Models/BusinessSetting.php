<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\RecordsActivity;
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
    use RecordsActivity;

    /** There is only one of these per business, so name it after the business. */
    public function activityLabel(): string
    {
        return $this->company_name ?: __('Business settings');
    }

    protected function casts(): array
    {
        return [
            'default_tax_rate' => 'decimal:2',
            'auto_close_daily' => 'boolean',
        ];
    }

    /**
     * What a business starts with, and what a row that somehow lost a value
     * falls back to.
     *
     * Written here rather than left to the column defaults in the schema.
     * The database applies those on insert, but the model handed back knows
     * nothing about them — it holds only what was written — so the first
     * read of a freshly created row answered null for the currency, the
     * locale, the invoice prefix and the rest. The screen then sent those
     * nulls back on save and was told, about six fields nobody had touched,
     * that they were required.
     *
     * @return array<string, mixed>
     */
    public static function defaults(): array
    {
        return [
            'company_name' => 'My Business',
            'currency_code' => 'AFN',
            'currency_symbol' => '؋',
            'default_locale' => 'en',
            'fiscal_year_start_month' => 1,
            'invoice_prefix' => 'INV-',
            'purchase_prefix' => 'PUR-',
            'default_tax_rate' => 0,
            'auto_close_daily' => false,
        ];
    }

    /**
     * Each tenant (business) has exactly one settings row; get the current
     * tenant's row, creating a complete one on first access. The tenant
     * scope on this model narrows the lookup, and the creating hook stamps
     * the tenant on the new row.
     */
    public static function current(): self
    {
        return static::query()->firstOrCreate([], self::defaults());
    }
}
