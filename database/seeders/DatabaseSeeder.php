<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // AdminUserSeeder provisions the default business (settings,
        // warehouse, cash account, units) for its own tenant; the other
        // provisioning seeders remain for single-tenant test setups.
        $this->call([
            RolesAndPermissionsSeeder::class,
            SuperAdminUserSeeder::class,
            AdminUserSeeder::class,
        ]);
    }
}
