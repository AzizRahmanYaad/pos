<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Database\Seeders\BusinessSettingsSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_list_users(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $this->actingAs($admin)
            ->getJson('/api/v1/users')
            ->assertOk();
    }

    public function test_cashier_cannot_list_users(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $cashier = User::factory()->create();
        $cashier->assignRole('cashier');

        $this->actingAs($cashier)
            ->getJson('/api/v1/users')
            ->assertForbidden();
    }

    public function test_cashier_cannot_update_business_settings(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $cashier = User::factory()->create();
        $cashier->assignRole('cashier');

        $this->actingAs($cashier)
            ->putJson('/api/v1/settings', ['company_name' => 'New Name'])
            ->assertForbidden();
    }

    public function test_admin_can_update_business_settings(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, BusinessSettingsSeeder::class]);

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $this->actingAs($admin)
            ->putJson('/api/v1/settings', ['company_name' => 'New Name'])
            ->assertOk()
            ->assertJsonPath('data.company_name', 'New Name');
    }
}
