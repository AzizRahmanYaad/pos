<?php

namespace App\Support;

use App\Models\BusinessSetting;
use App\Models\CashAccount;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\Warehouse;

/**
 * Sets up the starter records a new business (tenant) needs to operate:
 * its settings row, a default warehouse, a cash drawer, and the common
 * measurement units. Idempotent per tenant.
 */
class TenantProvisioner
{
    public function provision(Tenant $tenant): void
    {
        TenantContext::run($tenant->id, function () use ($tenant) {
            BusinessSetting::query()->firstOrCreate([], ['company_name' => $tenant->name]);

            Warehouse::query()->firstOrCreate(
                ['is_default' => true],
                ['name' => 'Main Warehouse', 'is_active' => true],
            );

            CashAccount::query()->firstOrCreate(
                ['name' => 'Cash Drawer'],
                ['type' => CashAccount::TYPE_CASH, 'is_active' => true],
            );

            $units = [
                ['name' => 'Piece', 'short_name' => 'pc'],
                ['name' => 'Kilogram', 'short_name' => 'kg'],
                ['name' => 'Gram', 'short_name' => 'g'],
                ['name' => 'Liter', 'short_name' => 'L'],
                ['name' => 'Meter', 'short_name' => 'm'],
                ['name' => 'Box', 'short_name' => 'box'],
                ['name' => 'Dozen', 'short_name' => 'dz'],
                ['name' => 'Carton', 'short_name' => 'ctn'],
            ];

            foreach ($units as $unit) {
                Unit::query()->firstOrCreate(
                    ['name' => $unit['name']],
                    [...$unit, 'conversion_factor' => 1],
                );
            }
        });
    }
}
