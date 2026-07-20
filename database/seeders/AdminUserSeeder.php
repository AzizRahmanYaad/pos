<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    /**
     * Seed the default administrator account. The password must be
     * changed immediately after first login in a production deployment.
     */
    public function run(): void
    {
        $admin = User::query()->firstOrCreate(
            ['email' => 'admin@example.com'],
            [
                'name' => 'Administrator',
                'password' => Hash::make('password'),
                'locale' => 'en',
                'is_active' => true,
                'email_verified_at' => now(),
            ],
        );

        if (! $admin->hasRole('pos_admin')) {
            $admin->syncRoles(['pos_admin']);
        }
    }
}
