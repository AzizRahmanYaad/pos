<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SuperAdminUserSeeder extends Seeder
{
    /**
     * Seed the default superadmin account, which manages POS users from
     * its own administration dashboard. The password must be changed
     * immediately after first login in a production deployment.
     */
    public function run(): void
    {
        $superadmin = User::query()->firstOrCreate(
            ['email' => 'superadmin@example.com'],
            [
                'name' => 'Super Administrator',
                'password' => Hash::make('password'),
                'locale' => 'en',
                'is_active' => true,
                'email_verified_at' => now(),
            ],
        );

        if (! $superadmin->hasRole('superadmin')) {
            $superadmin->assignRole('superadmin');
        }
    }
}
