<?php

namespace Database\Seeders;

use App\Models\Tenant;
use App\Models\User;
use App\Support\TenantProvisioner;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    /**
     * Seed the default administrator account with its own business
     * (tenant). The password must be changed immediately after first
     * login in a production deployment.
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
                'access_expires_at' => now()->addYear(),
                'email_verified_at' => now(),
            ],
        );

        if (! $admin->hasRole('admin')) {
            $admin->assignRole('admin');
        }

        if ($admin->tenant_id === null) {
            $tenant = Tenant::query()->firstOrCreate(['name' => 'Default Business']);
            $admin->update(['tenant_id' => $tenant->id]);
        }

        app(TenantProvisioner::class)->provision($admin->tenant()->firstOrFail());
    }
}
