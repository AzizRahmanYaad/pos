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

    public function test_superadmin_can_list_users(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $superadmin = User::factory()->create();
        $superadmin->assignRole('superadmin');

        $this->actingAs($superadmin)
            ->getJson('/api/v1/users')
            ->assertOk();
    }

    public function test_admin_cannot_list_users(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $this->actingAs($admin)
            ->getJson('/api/v1/users')
            ->assertForbidden();
    }

    public function test_superadmin_can_create_pos_user(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $superadmin = User::factory()->create();
        $superadmin->assignRole('superadmin');

        $this->actingAs($superadmin)
            ->postJson('/api/v1/users', [
                'name' => 'New Cashier',
                'email' => 'cashier@example.com',
                'password' => 'Secret123!',
                'password_confirmation' => 'Secret123!',
                'locale' => 'en',
                'is_active' => true,
                'roles' => ['cashier'],
            ])
            ->assertCreated()
            ->assertJsonPath('data.roles.0', 'cashier');
    }

    public function test_superadmin_cannot_deactivate_own_account(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $superadmin = User::factory()->create();
        $superadmin->assignRole('superadmin');

        $this->actingAs($superadmin)
            ->putJson("/api/v1/users/{$superadmin->id}", ['is_active' => false])
            ->assertUnprocessable();
    }

    public function test_superadmin_has_no_pos_operations_access(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $superadmin = User::factory()->create();
        $superadmin->assignRole('superadmin');

        $this->actingAs($superadmin)
            ->getJson('/api/v1/dashboard/summary')
            ->assertForbidden();

        $this->actingAs($superadmin)
            ->postJson('/api/v1/sales', [])
            ->assertForbidden();
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
