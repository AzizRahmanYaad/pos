<?php

namespace Tests\Feature\Auth;

use App\Models\Product;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\BusinessSettingsSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Hiding a menu is a courtesy; the API refusing the call is the actual
 * protection. These check the second one — a user who types the URL, or
 * calls the endpoint directly, gets nothing they were not granted.
 */
class GranularPermissionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(BusinessSettingsSeeder::class);
    }

    private function userWith(string ...$permissions): User
    {
        $tenant = Tenant::create(['name' => 'Kabul Mart']);
        $user = User::factory()->create(['tenant_id' => $tenant->id]);
        $user->syncPermissions($permissions);

        return $user->refresh();
    }

    /** Create a record inside the user's own business, so the tenant scope
     * does not hide it and we are genuinely testing the permission. */
    private function withinTenantOf(User $user, callable $callback): mixed
    {
        return \App\Support\TenantContext::run($user->tenant_id, $callback);
    }

    public function test_viewing_a_module_does_not_imply_changing_it(): void
    {
        $user = $this->userWith('products.view');
        $product = $this->withinTenantOf($user, fn () => Product::factory()->create());

        $this->actingAs($user)->getJson('/api/v1/products')->assertOk();

        $this->actingAs($user)->postJson('/api/v1/products', [
            'sku' => 'NEW-1',
            'name' => 'Blocked',
            'unit_id' => $product->unit_id,
            'type' => 'standard',
            'sale_price' => 10,
            'default_cost' => 5,
            'reorder_level' => 0,
        ])->assertForbidden();

        $this->actingAs($user)->putJson("/api/v1/products/{$product->id}", ['name' => 'Renamed'])->assertForbidden();
        $this->actingAs($user)->deleteJson("/api/v1/products/{$product->id}")->assertForbidden();

        $this->assertSame($product->name, $product->fresh()->name);
    }

    public function test_exporting_is_a_grant_of_its_own(): void
    {
        $viewer = $this->userWith('products.view');
        $exporter = $this->userWith('products.view', 'products.export');

        $this->actingAs($viewer)->get('/api/v1/products/report/pdf')->assertForbidden();
        $this->actingAs($exporter)->get('/api/v1/products/report/pdf')->assertOk();
    }

    public function test_the_dashboard_journal_and_reports_are_separately_gated(): void
    {
        $journalOnly = $this->userWith('journal.view');

        $this->actingAs($journalOnly)->getJson('/api/v1/reports/daily-journal')->assertOk();
        // Holding the journal must not open the whole reporting suite.
        $this->actingAs($journalOnly)->getJson('/api/v1/reports/profit-loss')->assertForbidden();
        $this->actingAs($journalOnly)->getJson('/api/v1/dashboard/summary')->assertForbidden();

        $reportsOnly = $this->userWith('reports.view');
        $this->actingAs($reportsOnly)->getJson('/api/v1/reports/profit-loss')->assertOk();
        $this->actingAs($reportsOnly)->getJson('/api/v1/reports/daily-journal')->assertForbidden();
    }

    public function test_stock_screens_are_closed_to_users_without_the_inventory_module(): void
    {
        $outsider = $this->userWith('products.view');

        $this->actingAs($outsider)->getJson('/api/v1/inventory/stock')->assertForbidden();
        $this->actingAs($outsider)->getJson('/api/v1/stock-movements')->assertForbidden();

        $insider = $this->userWith('inventory.view');
        $this->actingAs($insider)->getJson('/api/v1/inventory/stock')->assertOk();
        $this->actingAs($insider)->getJson('/api/v1/stock-movements')->assertOk();
    }

    public function test_adjusting_stock_is_separate_from_reading_it(): void
    {
        $reader = $this->userWith('inventory.view');

        $this->actingAs($reader)->postJson('/api/v1/stock-adjustments', [
            'product_id' => Product::factory()->create()->id,
            'warehouse_id' => \App\Models\Warehouse::factory()->create()->id,
            'quantity' => 5,
            'reason' => 'Recount',
        ])->assertForbidden();
    }

    public function test_business_settings_cannot_be_changed_without_the_grant(): void
    {
        $viewer = $this->userWith('settings.view');

        $this->actingAs($viewer)->putJson('/api/v1/settings', ['company_name' => 'Hijacked'])->assertForbidden();

        $editor = $this->userWith('settings.view', 'settings.edit');
        $this->actingAs($editor)->putJson('/api/v1/settings', ['company_name' => 'Renamed'])->assertSuccessful();
    }

    public function test_a_user_with_no_permissions_reaches_nothing(): void
    {
        $nobody = $this->userWith();

        foreach ([
            '/api/v1/products',
            '/api/v1/customers',
            '/api/v1/suppliers',
            '/api/v1/purchases',
            '/api/v1/sales',
            '/api/v1/expenses',
            '/api/v1/employees',
            '/api/v1/payroll-runs',
            '/api/v1/users',
            '/api/v1/inventory/stock',
            '/api/v1/dashboard/summary',
            '/api/v1/reports/profit-loss',
        ] as $endpoint) {
            $this->actingAs($nobody)->getJson($endpoint)->assertForbidden();
        }
    }
}
