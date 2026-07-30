<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\RecordsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

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
     * Each tenant (business) has exactly one settings row; get the current
     * tenant's row, creating the default row on first access. The tenant
     * scope on this model narrows the lookup, and the creating hook stamps
     * the tenant on the new row.
     *
     * The platform owner belongs to no business, and for it the tenant scope
     * narrows nothing — so this used to answer with whichever company's row
     * happened to be first, which is how the superadmin's header came to
     * display a customer's shop name as though it were their own. It owns no
     * business, so it gets no business settings.
     *
     * Keyed on the platform owner rather than on a missing tenant, because a
     * missing tenant is also how a single-business install and the whole test
     * suite run, and neither of those should stop having settings.
     */
    public static function current(): self
    {
        if (Auth::user()?->isPlatformOwner() === true) {
            return new self();
        }

        return static::query()->firstOrCreate([]);
    }
}
