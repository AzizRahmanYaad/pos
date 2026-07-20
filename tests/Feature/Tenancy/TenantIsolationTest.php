<?php

namespace Tests\Feature\Tenancy;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    private function superadmin(): User
    {
        $superadmin = User::factory()->create();
        $superadmin->assignRole('superadmin');

        return $superadmin;
    }

    /**
     * Create a business (admin POS account) through the API, the way the
     * superadmin does it, and return the signed-in owner.
     */
    private function createBusiness(string $name, string $email): User
    {
        $this->actingAs($this->superadmin())
            ->postJson('/api/v1/users', [
                'name' => $name,
                'email' => $email,
                'password' => 'Secret123!',
                'password_confirmation' => 'Secret123!',
                'locale' => 'en',
                'is_active' => true,
                'roles' => ['admin'],
            ])
            ->assertCreated();

        return User::query()->where('email', $email)->firstOrFail();
    }

    public function test_creating_a_business_provisions_its_own_defaults(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $owner = $this->createBusiness('Kabul Mart', 'kabul@example.com');

        $this->assertNotNull($owner->tenant_id);

        $this->actingAs($owner)->getJson('/api/v1/warehouses')->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($owner)->getJson('/api/v1/cash-accounts')->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($owner)->getJson('/api/v1/units')->assertOk()->assertJsonCount(8, 'data');
        $this->actingAs($owner)->getJson('/api/v1/settings')->assertOk()
            ->assertJsonPath('data.company_name', 'Kabul Mart');
    }

    public function test_each_business_only_sees_its_own_products_and_customers(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $ownerA = $this->createBusiness('Shop A', 'a@example.com');
        $ownerB = $this->createBusiness('Shop B', 'b@example.com');

        $unitA = $this->actingAs($ownerA)->getJson('/api/v1/units')->json('data.0.id');

        $this->actingAs($ownerA)->postJson('/api/v1/products', [
            'sku' => 'TEA-1', 'name' => 'Green Tea', 'unit_id' => $unitA, 'type' => 'standard',
            'sale_price' => 100, 'default_cost' => 60, 'tax_rate' => 0, 'reorder_level' => 0,
        ])->assertCreated();

        $this->actingAs($ownerA)->postJson('/api/v1/customers', ['name' => 'Customer A'])->assertCreated();

        // Shop B sees none of Shop A's data.
        $this->actingAs($ownerB)->getJson('/api/v1/products')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($ownerB)->getJson('/api/v1/customers')->assertOk()->assertJsonCount(0, 'data');

        // The same SKU is allowed in a different business.
        $unitB = $this->actingAs($ownerB)->getJson('/api/v1/units')->json('data.0.id');
        $this->actingAs($ownerB)->postJson('/api/v1/products', [
            'sku' => 'TEA-1', 'name' => 'Black Tea', 'unit_id' => $unitB, 'type' => 'standard',
            'sale_price' => 90, 'default_cost' => 50, 'tax_rate' => 0, 'reorder_level' => 0,
        ])->assertCreated();

        $this->actingAs($ownerA)->getJson('/api/v1/products')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Green Tea');
    }

    public function test_business_settings_are_isolated_per_tenant(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $ownerA = $this->createBusiness('Shop A', 'a2@example.com');
        $ownerB = $this->createBusiness('Shop B', 'b2@example.com');

        $this->actingAs($ownerA)->putJson('/api/v1/settings', ['company_name' => 'Renamed A'])->assertOk();

        $this->actingAs($ownerB)->getJson('/api/v1/settings')->assertOk()
            ->assertJsonPath('data.company_name', 'Shop B');
    }

    public function test_a_business_cannot_read_another_businesss_record_by_id(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $ownerA = $this->createBusiness('Shop A', 'a3@example.com');
        $ownerB = $this->createBusiness('Shop B', 'b3@example.com');

        $customerId = $this->actingAs($ownerA)
            ->postJson('/api/v1/customers', ['name' => 'Secret Customer'])
            ->json('data.id');

        $this->actingAs($ownerB)->getJson("/api/v1/customers/{$customerId}")->assertNotFound();
    }

    public function test_staff_accounts_must_belong_to_a_business(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $owner = $this->createBusiness('Shop A', 'a4@example.com');

        // Without a business: rejected.
        $this->actingAs($this->superadmin())->postJson('/api/v1/users', [
            'name' => 'Floating Cashier',
            'email' => 'floating@example.com',
            'password' => 'Secret123!',
            'password_confirmation' => 'Secret123!',
            'locale' => 'en',
            'is_active' => true,
            'roles' => ['cashier'],
        ])->assertUnprocessable();

        // Attached to Shop A: sees Shop A's data.
        $this->actingAs($this->superadmin())->postJson('/api/v1/users', [
            'name' => 'Shop A Cashier',
            'email' => 'cashier-a@example.com',
            'password' => 'Secret123!',
            'password_confirmation' => 'Secret123!',
            'locale' => 'en',
            'is_active' => true,
            'roles' => ['cashier'],
            'tenant_id' => $owner->tenant_id,
        ])->assertCreated()->assertJsonPath('data.tenant_id', $owner->tenant_id);

        $cashier = User::query()->where('email', 'cashier-a@example.com')->firstOrFail();

        $this->actingAs($ownerA = $owner)->postJson('/api/v1/customers', ['name' => 'Walk-in Regular'])->assertCreated();
        $this->actingAs($cashier)->getJson('/api/v1/customers')->assertOk()->assertJsonCount(1, 'data');
    }
}
