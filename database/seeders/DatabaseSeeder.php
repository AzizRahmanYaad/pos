<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // AdminUserSeeder provisions the default business (settings,
        // warehouse, cash account, units) for its own tenant; the other
        // provisioning seeders remain for single-tenant test setups.
        // Deliberately not using WithoutModelEvents: it disables every
        // model's `creating` hook app-wide for this whole run, including
        // BelongsToTenant's tenant_id stamp — silently leaving the
        // provisioned warehouse/cash account/units with a null tenant_id,
        // invisible to the tenant they were just created for.
        $this->call([
            RolesAndPermissionsSeeder::class,
            SuperAdminUserSeeder::class,
        ]);

        // The demo business is for a machine somebody is developing on. A
        // live platform gets its businesses from the platform owner opening
        // them, and this seeder runs on every deploy — so on production it
        // would put admin@example.com and its "Default Business" back a few
        // minutes after anybody deleted them, password and all.
        if (! app()->isProduction()) {
            $this->call(AdminUserSeeder::class);
        }
    }
}
