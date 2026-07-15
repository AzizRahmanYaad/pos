<?php

namespace Database\Seeders;

use App\Models\Warehouse;
use Illuminate\Database\Seeder;

class DefaultWarehouseSeeder extends Seeder
{
    /**
     * Seed the default warehouse every fresh install needs before stock
     * can be tracked.
     */
    public function run(): void
    {
        Warehouse::query()->firstOrCreate(
            ['is_default' => true],
            ['name' => 'Main Warehouse', 'is_active' => true],
        );
    }
}
