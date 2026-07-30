<?php

namespace Tests\Feature\Inventory;

use App\Domain\Inventory\Actions\RecordStockMovementAction;
use App\Domain\Inventory\Exceptions\InsufficientStockException;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StockMovementTest extends TestCase
{
    use RefreshDatabase;

    public function test_incoming_movement_increases_quantity_and_updates_weighted_average_cost(): void
    {
        $product = Product::factory()->create(['default_cost' => 0]);
        $warehouse = Warehouse::factory()->create();

        $action = app(RecordStockMovementAction::class);

        $action->execute($product, $warehouse, StockMovement::TYPE_PURCHASE, 10, 5.00);
        $movement = $action->execute($product, $warehouse, StockMovement::TYPE_PURCHASE, 10, 7.00);

        // (10*5 + 10*7) / 20 = 6.00
        $this->assertSame(20.0, (float) $movement->balance_after);
        $this->assertEquals(6.0, (float) $product->stocks()->where('warehouse_id', $warehouse->id)->first()->average_cost);
    }

    public function test_outgoing_movement_does_not_change_average_cost(): void
    {
        $product = Product::factory()->create();
        $warehouse = Warehouse::factory()->create();
        $action = app(RecordStockMovementAction::class);

        $action->execute($product, $warehouse, StockMovement::TYPE_PURCHASE, 10, 8.00);
        $action->execute($product, $warehouse, StockMovement::TYPE_SALE, -4);

        $stock = $product->stocks()->where('warehouse_id', $warehouse->id)->first();
        $this->assertEquals(6.0, (float) $stock->quantity);
        $this->assertEquals(8.0, (float) $stock->average_cost);
    }

    public function test_movement_that_would_go_negative_is_rejected(): void
    {
        $product = Product::factory()->create();
        $warehouse = Warehouse::factory()->create();
        $action = app(RecordStockMovementAction::class);

        $this->expectException(InsufficientStockException::class);
        $action->execute($product, $warehouse, StockMovement::TYPE_SALE, -1);
    }

    public function test_manager_can_create_stock_adjustment_via_api(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $this->grantRole($manager, 'manager');

        $product = Product::factory()->create();
        $warehouse = Warehouse::factory()->create();

        $response = $this->actingAs($manager)->postJson('/api/v1/stock-adjustments', [
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'quantity' => 15,
            'reason' => 'Initial stock count',
        ]);

        $response->assertCreated()->assertJsonPath('data.balance_after', 15);
    }

    public function test_cashier_cannot_create_stock_adjustment(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $cashier = User::factory()->create();
        $this->grantRole($cashier, 'cashier');

        $product = Product::factory()->create();
        $warehouse = Warehouse::factory()->create();

        $this->actingAs($cashier)->postJson('/api/v1/stock-adjustments', [
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'quantity' => 5,
            'reason' => 'test',
        ])->assertForbidden();
    }

    public function test_negative_adjustment_beyond_available_stock_returns_conflict(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $this->grantRole($manager, 'manager');

        $product = Product::factory()->create();
        $warehouse = Warehouse::factory()->create();

        $this->actingAs($manager)->postJson('/api/v1/stock-adjustments', [
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'quantity' => -5,
            'reason' => 'Damaged goods',
        ])->assertStatus(409);
    }

    public function test_stock_movements_can_be_listed(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $this->grantRole($manager, 'manager');

        $product = Product::factory()->create();
        $warehouse = Warehouse::factory()->create();
        app(RecordStockMovementAction::class)->execute($product, $warehouse, StockMovement::TYPE_OPENING, 50, 2.5);

        $this->actingAs($manager)
            ->getJson('/api/v1/stock-movements')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_stock_list_reports_status_per_product(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $this->grantRole($manager, 'manager');
        $warehouse = Warehouse::factory()->create();

        $healthy = Product::factory()->create(['track_inventory' => true, 'reorder_level' => 5]);
        $low = Product::factory()->create(['track_inventory' => true, 'reorder_level' => 10]);
        $out = Product::factory()->create(['track_inventory' => true, 'reorder_level' => 5]);

        app(RecordStockMovementAction::class)->execute($healthy, $warehouse, StockMovement::TYPE_OPENING, 50, 2.5);
        app(RecordStockMovementAction::class)->execute($low, $warehouse, StockMovement::TYPE_OPENING, 3, 2.5);
        // $out gets no stock movement, so its total stays at 0.

        $response = $this->actingAs($manager)->getJson('/api/v1/inventory/stock')->assertOk();
        $byId = collect($response->json('data'))->keyBy('id');

        $this->assertEquals('ok', $byId[$healthy->id]['status']);
        $this->assertEquals('low', $byId[$low->id]['status']);
        $this->assertEquals('out', $byId[$out->id]['status']);
        $this->assertEquals(50.0, $byId[$healthy->id]['total_stock']);
    }

    public function test_stock_summary_counts_low_and_out_of_stock(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $this->grantRole($manager, 'manager');
        $warehouse = Warehouse::factory()->create();

        Product::factory()->create(['track_inventory' => true, 'reorder_level' => 5]);
        $low = Product::factory()->create(['track_inventory' => true, 'reorder_level' => 10]);
        app(RecordStockMovementAction::class)->execute($low, $warehouse, StockMovement::TYPE_OPENING, 3, 2.5);

        $this->actingAs($manager)
            ->getJson('/api/v1/inventory/stock/summary')
            ->assertOk()
            ->assertJsonPath('data.low_stock_count', 1)
            ->assertJsonPath('data.out_of_stock_count', 1);
    }

    public function test_stock_alerts_only_include_low_and_out_of_stock_products(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $this->grantRole($manager, 'manager');
        $warehouse = Warehouse::factory()->create();

        $healthy = Product::factory()->create(['track_inventory' => true, 'reorder_level' => 5, 'is_active' => true]);
        app(RecordStockMovementAction::class)->execute($healthy, $warehouse, StockMovement::TYPE_OPENING, 50, 2.5);
        $low = Product::factory()->create(['track_inventory' => true, 'reorder_level' => 10, 'is_active' => true]);
        app(RecordStockMovementAction::class)->execute($low, $warehouse, StockMovement::TYPE_OPENING, 3, 2.5);

        $response = $this->actingAs($manager)->getJson('/api/v1/inventory/stock/alerts')->assertOk();
        $ids = collect($response->json('data'))->pluck('id');

        $this->assertTrue($ids->contains($low->id));
        $this->assertFalse($ids->contains($healthy->id));
    }

    /**
     * A shop with a real catalogue was sending every tracked product down
     * the wire on every visit to the Stocks page. It arrives a page at a
     * time now, with the count of everything that matched.
     */
    public function test_the_stock_list_arrives_a_page_at_a_time(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $this->grantRole($manager, 'manager');

        Product::factory()->count(30)->create(['track_inventory' => true]);
        // Not tracked, so not stock — it must not swell the count either.
        Product::factory()->create(['track_inventory' => false]);

        $first = $this->actingAs($manager)->getJson('/api/v1/inventory/stock')->assertOk();

        $first->assertJsonCount(25, 'data')
            ->assertJsonPath('meta.total', 30)
            ->assertJsonPath('meta.current_page', 1)
            ->assertJsonPath('meta.last_page', 2)
            ->assertJsonPath('meta.per_page', 25);

        $second = $this->actingAs($manager)->getJson('/api/v1/inventory/stock?page=2')->assertOk();
        $second->assertJsonCount(5, 'data')->assertJsonPath('meta.current_page', 2);

        // The two pages are different products, and between them the lot.
        $ids = collect($first->json('data'))->pluck('id')
            ->merge(collect($second->json('data'))->pluck('id'));

        $this->assertCount(30, $ids->unique());
    }

    /** The whole list in one call, for a device filling its offline cache. */
    public function test_a_bigger_page_can_be_asked_for(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $this->grantRole($manager, 'manager');

        Product::factory()->count(30)->create(['track_inventory' => true]);

        $this->actingAs($manager)
            ->getJson('/api/v1/inventory/stock?per_page=500')
            ->assertOk()
            ->assertJsonCount(30, 'data')
            ->assertJsonPath('meta.last_page', 1);
    }

    /**
     * The count belongs to the filter, not to the catalogue: a shopkeeper
     * asking what needs reordering is told how many products that is.
     */
    public function test_the_count_is_of_what_matched_the_filter(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $this->grantRole($manager, 'manager');
        $warehouse = Warehouse::factory()->create();

        $stocked = Product::factory()->count(3)->create(['track_inventory' => true, 'reorder_level' => 5]);

        foreach ($stocked as $product) {
            app(RecordStockMovementAction::class)->execute($product, $warehouse, StockMovement::TYPE_OPENING, 50, 2.5);
        }

        Product::factory()->count(2)->create(['track_inventory' => true, 'reorder_level' => 5]);

        $this->actingAs($manager)
            ->getJson('/api/v1/inventory/stock?status=out')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.total', 2);
    }

    /**
     * Narrowing the filter while reading page three used to answer with an
     * empty table over a total that said there was plenty.
     */
    public function test_a_page_past_the_end_answers_with_the_last_one(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $this->grantRole($manager, 'manager');

        Product::factory()->count(3)->create(['track_inventory' => true]);

        $this->actingAs($manager)
            ->getJson('/api/v1/inventory/stock?page=9')
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('meta.current_page', 1);
    }

    public function test_cashier_cannot_view_stock_list(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $cashier = User::factory()->create();
        $this->grantRole($cashier, 'cashier');

        $this->actingAs($cashier)->getJson('/api/v1/inventory/stock')->assertForbidden();
    }
}
