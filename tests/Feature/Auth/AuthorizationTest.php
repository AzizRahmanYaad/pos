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

    /**
     * A Company Admin runs their own business's accounts, but the list they
     * get back stops at their own business — other companies' staff are not
     * theirs to see.
     */
    public function test_company_admin_lists_only_their_own_businesss_users(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $mine = \App\Models\Tenant::create(['name' => 'Mine']);
        $theirs = \App\Models\Tenant::create(['name' => 'Theirs']);

        $admin = User::factory()->create(['tenant_id' => $mine->id, 'name' => 'Owner']);
        $admin->assignRole('admin');

        // Hired by this admin, so theirs to manage.
        User::factory()->create(['tenant_id' => $mine->id, 'name' => 'My Cashier', 'created_by' => $admin->id]);
        // Same business, but hired by a different admin — not theirs.
        User::factory()->create(['tenant_id' => $mine->id, 'name' => 'Someone Elses Cashier']);
        // Another business entirely.
        User::factory()->create(['tenant_id' => $theirs->id, 'name' => 'Their Cashier']);

        $response = $this->actingAs($admin)->getJson('/api/v1/users')->assertOk();

        $names = collect($response->json('data'))->pluck('name');
        $this->assertEqualsCanonicalizing(['Owner', 'My Cashier'], $names->all());
    }

    public function test_superadmin_can_create_pos_user(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $superadmin = User::factory()->create();
        $superadmin->assignRole('superadmin');

        $this->actingAs($superadmin)
            ->postJson('/api/v1/users', [
                'name' => 'New Business',
                'email' => 'owner@example.com',
                'password' => 'Secret123!',
                'password_confirmation' => 'Secret123!',
                'locale' => 'en',
                'is_active' => true,
                'roles' => ['admin'],
            ])
            ->assertCreated()
            ->assertJsonPath('data.roles.0', 'admin')
            ->assertJsonPath('data.tenant_name', 'New Business');
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
        $this->grantRole($cashier, 'cashier');

        $this->actingAs($cashier)
            ->getJson('/api/v1/users')
            ->assertForbidden();
    }

    public function test_cashier_cannot_update_business_settings(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $cashier = User::factory()->create();
        $this->grantRole($cashier, 'cashier');

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
