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
            AdminUserSeeder::class,
        ]);
    }
}
