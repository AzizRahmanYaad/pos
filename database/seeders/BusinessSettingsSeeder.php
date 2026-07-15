<?php

namespace Database\Seeders;

use App\Models\BusinessSetting;
use Illuminate\Database\Seeder;

class BusinessSettingsSeeder extends Seeder
{
    /**
     * Seed the default (singleton) business settings row.
     */
    public function run(): void
    {
        BusinessSetting::current();
    }
}
