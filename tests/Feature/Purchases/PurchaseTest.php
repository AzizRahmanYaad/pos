<?php

namespace Tests\Feature\Purchases;

use App\Domain\Purchases\Actions\CreatePurchaseAction;
use App\Domain\Purchases\Actions\ReceivePurchaseAction;
use App\Domain\Purchases\Exceptions\PurchaseAlreadyProcessedException;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\BusinessSettingsSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PurchaseTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(BusinessSettingsSeeder::class);
    }

    public function test_creating_a_purchase_computes_totals(): void
    {
        $supplier = Supplier::factory()->create();
        $warehouse = Warehouse::factory()->create();
        $productA = Product::factory()->create();
        $productB = Product::factory()->create();

        $purchase = app(CreatePurchaseAction::class)->execute(
            data: ['supplier_id' => $supplier->id, 'warehouse_id' => $warehouse->id, 'purchase_date' => now(), 'tax' => 10],
            items: [
                ['product_id' => $productA->id, 'quantity' => 10, 'unit_id' => $productA->unit_id, 'unit_cost' => 5],
                ['product_id' => $productB->id, 'quantity' => 5, 'unit_id' => $productB->unit_id, 'unit_cost' => 20],
            ],
            landedCosts: [
                ['description' => 'Transport', 'amount' => 30],
            ],
            createdBy: User::factory()->create()->id,
        );

        // subtotal = 10*5 + 5*20 = 150; grand_total = 150 - 0 + 10 = 160
        $this->assertEquals(150.0, (float) $purchase->subtotal);
        $this->assertEquals(160.0, (float) $purchase->grand_total);
        $this->assertEquals(30.0, (float) $purchase->landed_cost_total);
        $this->assertEquals(Purchase::STATUS_DRAFT, $purchase->status);
        $this->assertStringStartsWith('PUR-', $purchase->purchase_number);
    }

    public function test_receiving_a_purchase_allocates_landed_cost_and_updates_stock(): void
    {
        $supplier = Supplier::factory()->create();
        $warehouse = Warehouse::factory()->create();
        $productA = Product::factory()->create();
        $productB = Product::factory()->create();
        $user = User::factory()->create();

        $purchase = app(CreatePurchaseAction::class)->execute(
            data: ['supplier_id' => $supplier->id, 'warehouse_id' => $warehouse->id, 'purchase_date' => now()],
            items: [
                // line value 100 (2/3 of total 150)
                ['product_id' => $productA->id, 'quantity' => 10, 'unit_id' => $productA->unit_id, 'unit_cost' => 10],
                // line value 50 (1/3 of total 150)
                ['product_id' => $productB->id, 'quantity' => 5, 'unit_id' => $productB->unit_id, 'unit_cost' => 10],
            ],
            landedCosts: [
                ['description' => 'Transport', 'amount' => 30],
            ],
            createdBy: $user->id,
        );

        $received = app(ReceivePurchaseAction::class)->execute($purchase, $user->id);

        $this->assertEquals(Purchase::STATUS_RECEIVED, $received->status);

        // Product A: allocated = 30 * (100/150) = 20; final unit cost = 10 + 20/10 = 12
        $stockA = $productA->stocks()->where('warehouse_id', $warehouse->id)->first();
        $this->assertEquals(10.0, (float) $stockA->quantity);
        $this->assertEquals(12.0, (float) $stockA->average_cost);

        // Product B: allocated = 30 * (50/150) = 10; final unit cost = 10 + 10/5 = 12
        $stockB = $productB->stocks()->where('warehouse_id', $warehouse->id)->first();
        $this->assertEquals(5.0, (float) $stockB->quantity);
        $this->assertEquals(12.0, (float) $stockB->average_cost);

        // Supplier credited for grand_total only (150), not including landed
        // costs — running_balance goes negative (business owes supplier).
        $this->assertEquals(-150.0, $supplier->fresh()->currentBalance());
    }

    public function test_receiving_an_already_received_purchase_throws(): void
    {
        $supplier = Supplier::factory()->create();
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();
        $user = User::factory()->create();

        $purchase = app(CreatePurchaseAction::class)->execute(
            data: ['supplier_id' => $supplier->id, 'warehouse_id' => $warehouse->id, 'purchase_date' => now()],
            items: [['product_id' => $product->id, 'quantity' => 1, 'unit_id' => $product->unit_id, 'unit_cost' => 10]],
            landedCosts: [],
            createdBy: $user->id,
        );

        app(ReceivePurchaseAction::class)->execute($purchase, $user->id);

        $this->expectException(PurchaseAlreadyProcessedException::class);
        app(ReceivePurchaseAction::class)->execute($purchase->fresh(), $user->id);
    }

    public function test_manager_can_create_and_receive_purchase_via_api(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $manager->assignRole('manager');

        $supplier = Supplier::factory()->create();
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();

        $createResponse = $this->actingAs($manager)->postJson('/api/v1/purchases', [
            'supplier_id' => $supplier->id,
            'warehouse_id' => $warehouse->id,
            'purchase_date' => now()->toDateTimeString(),
            'items' => [
                ['product_id' => $product->id, 'quantity' => 4, 'unit_id' => $product->unit_id, 'unit_cost' => 25],
            ],
        ]);
        $createResponse->assertCreated();
        $purchaseId = $createResponse->json('data.id');

        $this->actingAs($manager)
            ->postJson("/api/v1/purchases/{$purchaseId}/receive")
            ->assertOk()
            ->assertJsonPath('data.status', Purchase::STATUS_RECEIVED);
    }

    public function test_cashier_cannot_create_purchase(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $cashier = User::factory()->create();
        $cashier->assignRole('cashier');

        $supplier = Supplier::factory()->create();
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();

        $this->actingAs($cashier)->postJson('/api/v1/purchases', [
            'supplier_id' => $supplier->id,
            'warehouse_id' => $warehouse->id,
            'purchase_date' => now()->toDateTimeString(),
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1, 'unit_id' => $product->unit_id, 'unit_cost' => 5],
            ],
        ])->assertForbidden();
    }

    public function test_cancelling_a_received_purchase_is_rejected(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $manager->assignRole('manager');

        $supplier = Supplier::factory()->create();
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();
        $purchase = app(CreatePurchaseAction::class)->execute(
            data: ['supplier_id' => $supplier->id, 'warehouse_id' => $warehouse->id, 'purchase_date' => now()],
            items: [['product_id' => $product->id, 'quantity' => 1, 'unit_id' => $product->unit_id, 'unit_cost' => 10]],
            landedCosts: [],
            createdBy: $manager->id,
        );
        app(ReceivePurchaseAction::class)->execute($purchase, $manager->id);

        $this->actingAs($manager)
            ->postJson("/api/v1/purchases/{$purchase->id}/cancel")
            ->assertStatus(409);
    }
}
