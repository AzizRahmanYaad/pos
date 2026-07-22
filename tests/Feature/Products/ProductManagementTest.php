<?php

namespace Tests\Feature\Products;

use App\Domain\Purchases\Actions\CreatePurchaseAction;
use App\Domain\Purchases\Actions\ReceivePurchaseAction;
use App\Models\Category;
use App\Models\Product;
use App\Models\Supplier;
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

    public function test_updating_a_product_to_margin_pricing_recalculates_sale_price_immediately(): void
    {
        $product = Product::factory()->create([
            'sale_price' => 122,
            'default_cost' => 78,
            'pricing_mode' => Product::PRICING_FIXED,
        ]);

        $response = $this->actingAs($this->manager)->putJson("/api/v1/products/{$product->id}", [
            'pricing_mode' => Product::PRICING_MARGIN,
            'margin_percent' => 25,
        ]);

        // No stock movements yet, so cost basis falls back to default_cost (78);
        // price should become 78 * 1.25 = 97.5 right away, not wait for a purchase.
        $response->assertOk();
        $this->assertEquals(97.5, (float) $product->fresh()->sale_price);
    }

    public function test_updating_a_product_to_profit_basis_pricing_divides_instead_of_multiplies(): void
    {
        $product = Product::factory()->create([
            'sale_price' => 100,
            'default_cost' => 80,
            'pricing_mode' => Product::PRICING_FIXED,
        ]);

        $response = $this->actingAs($this->manager)->putJson("/api/v1/products/{$product->id}", [
            'pricing_mode' => Product::PRICING_MARGIN,
            'margin_basis' => Product::MARGIN_BASIS_PROFIT,
            'margin_percent' => 20,
        ]);

        // "20% profit of the selling price" (not 20% markup on cost):
        // price = 80 / (1 - 0.20) = 100 -> profit of 20 is exactly 20% of 100.
        $response->assertOk();
        $this->assertEquals(100.0, (float) $product->fresh()->sale_price);
    }

    public function test_markup_and_profit_basis_produce_different_prices_for_the_same_percentage(): void
    {
        $markupProduct = Product::factory()->create([
            'default_cost' => 100,
            'pricing_mode' => Product::PRICING_FIXED,
        ]);
        $profitProduct = Product::factory()->create([
            'default_cost' => 100,
            'pricing_mode' => Product::PRICING_FIXED,
        ]);

        $this->actingAs($this->manager)->putJson("/api/v1/products/{$markupProduct->id}", [
            'pricing_mode' => Product::PRICING_MARGIN,
            'margin_basis' => Product::MARGIN_BASIS_MARKUP,
            'margin_percent' => 20,
        ])->assertOk();

        $this->actingAs($this->manager)->putJson("/api/v1/products/{$profitProduct->id}", [
            'pricing_mode' => Product::PRICING_MARGIN,
            'margin_basis' => Product::MARGIN_BASIS_PROFIT,
            'margin_percent' => 20,
        ])->assertOk();

        // Same cost, same percentage, deliberately different prices: 20%
        // markup on 100 is 120; 20% profit of the selling price needs 125
        // (25 profit on a 125 price is exactly 20% of 125).
        $this->assertEquals(120.0, (float) $markupProduct->fresh()->sale_price);
        $this->assertEquals(125.0, (float) $profitProduct->fresh()->sale_price);
    }

    public function test_profit_percentage_of_100_or_more_is_rejected(): void
    {
        $product = Product::factory()->create(['default_cost' => 50]);

        $this->actingAs($this->manager)->putJson("/api/v1/products/{$product->id}", [
            'pricing_mode' => Product::PRICING_MARGIN,
            'margin_basis' => Product::MARGIN_BASIS_PROFIT,
            'margin_percent' => 100,
        ])->assertUnprocessable();
    }

    public function test_creating_a_product_with_margin_pricing_computes_initial_sale_price(): void
    {
        $unit = Unit::factory()->create();

        $response = $this->actingAs($this->manager)->postJson('/api/v1/products', [
            'sku' => 'SKU-MARGIN',
            'name' => 'Margin Product',
            'unit_id' => $unit->id,
            'type' => Product::TYPE_STANDARD,
            'sale_price' => 1,
            'pricing_mode' => Product::PRICING_MARGIN,
            'margin_percent' => 50,
            'default_cost' => 40,
            'tax_rate' => 0,
            'reorder_level' => 0,
        ]);

        $response->assertCreated();
        $this->assertEquals(60.0, (float) $response->json('data.sale_price'));
    }

    public function test_manager_can_update_a_products_details(): void
    {
        $unit = Unit::factory()->create();
        $category = Category::factory()->create();
        $product = Product::factory()->create(['name' => 'Old name', 'sku' => 'OLD-SKU']);

        $response = $this->actingAs($this->manager)->putJson("/api/v1/products/{$product->id}", [
            'name' => 'New name',
            'sku' => 'NEW-SKU',
            'category_id' => $category->id,
            'unit_id' => $unit->id,
            'reorder_level' => 15,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.name', 'New name')
            ->assertJsonPath('data.sku', 'NEW-SKU');
        $this->assertEquals(15.0, (float) $product->fresh()->reorder_level);
    }

    public function test_manager_can_delete_a_product_with_no_history(): void
    {
        $product = Product::factory()->create();

        $this->actingAs($this->manager)
            ->deleteJson("/api/v1/products/{$product->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('products', ['id' => $product->id]);
    }

    public function test_deleting_a_product_with_transaction_history_is_rejected(): void
    {
        $supplier = Supplier::factory()->create();
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();

        $purchase = app(CreatePurchaseAction::class)->execute(
            data: ['supplier_id' => $supplier->id, 'warehouse_id' => $warehouse->id, 'purchase_date' => now()],
            items: [['product_id' => $product->id, 'quantity' => 1, 'unit_id' => $product->unit_id, 'unit_cost' => 10]],
            landedCosts: [],
            createdBy: $this->manager->id,
        );
        app(ReceivePurchaseAction::class)->execute($purchase, $this->manager->id);

        $this->actingAs($this->manager)
            ->deleteJson("/api/v1/products/{$product->id}")
            ->assertStatus(409);

        $this->assertDatabaseHas('products', ['id' => $product->id]);
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
