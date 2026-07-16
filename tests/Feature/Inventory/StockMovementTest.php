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
        $manager->assignRole('manager');

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
        $cashier->assignRole('cashier');

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
        $manager->assignRole('manager');

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
        $manager->assignRole('manager');

        $product = Product::factory()->create();
        $warehouse = Warehouse::factory()->create();
        app(RecordStockMovementAction::class)->execute($product, $warehouse, StockMovement::TYPE_OPENING, 50, 2.5);

        $this->actingAs($manager)
            ->getJson('/api/v1/stock-movements')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }
}
