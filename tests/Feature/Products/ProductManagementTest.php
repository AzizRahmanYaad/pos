<?php

namespace Tests\Feature\Products;

use App\Models\Category;
use App\Models\Product;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $manager;

    private User $cashier;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);

        $this->manager = User::factory()->create();
        $this->manager->assignRole('manager');

        $this->cashier = User::factory()->create();
        $this->cashier->assignRole('cashier');
    }

    public function test_manager_can_create_a_product(): void
    {
        $unit = Unit::factory()->create();
        $category = Category::factory()->create();

        $response = $this->actingAs($this->manager)->postJson('/api/v1/products', [
            'sku' => 'SKU-001',
            'name' => 'Test Product',
            'category_id' => $category->id,
            'unit_id' => $unit->id,
            'type' => Product::TYPE_STANDARD,
            'sale_price' => 100,
            'default_cost' => 60,
            'tax_rate' => 0,
            'reorder_level' => 5,
        ]);

        $response->assertCreated()->assertJsonPath('data.sku', 'SKU-001');
    }

    public function test_cashier_cannot_create_a_product(): void
    {
        $unit = Unit::factory()->create();

        $this->actingAs($this->cashier)->postJson('/api/v1/products', [
            'sku' => 'SKU-002',
            'name' => 'Test Product',
            'unit_id' => $unit->id,
            'type' => Product::TYPE_STANDARD,
            'sale_price' => 100,
            'default_cost' => 60,
            'tax_rate' => 0,
            'reorder_level' => 5,
        ])->assertForbidden();
    }

    public function test_any_authenticated_user_can_list_products(): void
    {
        Product::factory()->count(3)->create();

        $this->actingAs($this->cashier)
            ->getJson('/api/v1/products')
            ->assertOk()
            ->assertJsonCount(3, 'data');
    }

    public function test_creating_product_backfills_stock_rows_for_existing_warehouses(): void
    {
        $warehouseA = Warehouse::factory()->create();
        $warehouseB = Warehouse::factory()->create();

        $product = Product::factory()->create();

        $this->assertDatabaseHas('product_stocks', ['product_id' => $product->id, 'warehouse_id' => $warehouseA->id]);
        $this->assertDatabaseHas('product_stocks', ['product_id' => $product->id, 'warehouse_id' => $warehouseB->id]);
    }

    public function test_creating_warehouse_backfills_stock_rows_for_existing_products(): void
    {
        $productA = Product::factory()->create();
        $productB = Product::factory()->create();

        $warehouse = Warehouse::factory()->create();

        $this->assertDatabaseHas('product_stocks', ['product_id' => $productA->id, 'warehouse_id' => $warehouse->id]);
        $this->assertDatabaseHas('product_stocks', ['product_id' => $productB->id, 'warehouse_id' => $warehouse->id]);
    }

    public function test_duplicate_sku_is_rejected(): void
    {
        $unit = Unit::factory()->create();
        Product::factory()->create(['sku' => 'DUPLICATE']);

        $this->actingAs($this->manager)->postJson('/api/v1/products', [
            'sku' => 'DUPLICATE',
            'name' => 'Another Product',
            'unit_id' => $unit->id,
            'type' => Product::TYPE_STANDARD,
            'sale_price' => 10,
            'default_cost' => 5,
            'tax_rate' => 0,
            'reorder_level' => 0,
        ])->assertUnprocessable();
    }
}
