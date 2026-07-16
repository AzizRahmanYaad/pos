<?php

namespace Database\Seeders;

use App\Models\CashAccount;
use Illuminate\Database\Seeder;

class DefaultCashAccountSeeder extends Seeder
{
    /**
     * Seed the default cash drawer account every fresh install needs
     * before payments can be recorded.
     */
    public function run(): void
    {
        CashAccount::query()->firstOrCreate(
            ['name' => 'Cash Drawer'],
            ['type' => CashAccount::TYPE_CASH, 'is_active' => true],
        );
    }
}
