<?php

namespace Tests\Feature\Settings;

use App\Models\Tenant;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Warehouses are set up once by whoever runs the business, not adjusted by
 * whoever is on the till.
 */
class WarehouseManagementTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->tenant = Tenant::create(['name' => 'Kabul Mart']);
    }

    private function admin(): User
    {
        $user = User::factory()->create(['tenant_id' => $this->tenant->id]);
        $user->assignRole('admin');

        return $user->refresh();
    }

    private function cashier(): User
    {
        $user = User::factory()->create(['tenant_id' => $this->tenant->id]);
        $this->grantRole($user, 'cashier');

        return $user->refresh();
    }

    public function test_an_admin_can_add_a_warehouse(): void
    {
        $this->actingAs($this->admin())
            ->postJson('/api/v1/warehouses', ['name' => 'Backroom', 'address' => 'Behind the shop'])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Backroom');

        $this->assertDatabaseHas('warehouses', ['name' => 'Backroom', 'tenant_id' => $this->tenant->id]);
    }

    public function test_a_cashier_cannot_add_edit_or_remove_one(): void
    {
        $admin = $this->admin();
        $this->actingAs($admin);
        $warehouse = Warehouse::create(['name' => 'Main', 'is_default' => true]);

        $cashier = $this->cashier();

        $this->actingAs($cashier)->postJson('/api/v1/warehouses', ['name' => 'Sneaky'])->assertForbidden();
        $this->actingAs($cashier)->putJson("/api/v1/warehouses/{$warehouse->id}", ['name' => 'Renamed'])->assertForbidden();
        $this->actingAs($cashier)->deleteJson("/api/v1/warehouses/{$warehouse->id}")->assertForbidden();

        $this->assertSame('Main', $warehouse->fresh()->name);
        $this->assertDatabaseMissing('warehouses', ['name' => 'Sneaky']);
    }

    public function test_a_warehouse_belongs_to_the_business_that_made_it(): void
    {
        $this->actingAs($this->admin())
            ->postJson('/api/v1/warehouses', ['name' => 'Ours'])
            ->assertCreated();

        $elsewhere = Tenant::create(['name' => 'Elsewhere']);
        $outsider = User::factory()->create(['tenant_id' => $elsewhere->id]);
        $outsider->assignRole('admin');

        $names = collect($this->actingAs($outsider->refresh())->getJson('/api/v1/warehouses')->assertOk()->json('data'))
            ->pluck('name');

        $this->assertNotContains('Ours', $names);
    }
}
