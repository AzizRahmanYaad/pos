<?php

namespace Database\Seeders;

use App\Models\Unit;
use Illuminate\Database\Seeder;

class DefaultUnitsSeeder extends Seeder
{
    /**
     * Seed the common measurement units so products can be created out of
     * the box. Idempotent: existing units are left untouched.
     */
    public function run(): void
    {
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
    }
}
