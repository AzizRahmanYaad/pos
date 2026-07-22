<?php

namespace Tests\Feature\Sales;

use App\Domain\Inventory\Actions\RecordStockMovementAction;
use App\Domain\Inventory\Exceptions\InsufficientStockException;
use App\Domain\Sales\Actions\CreateSaleAction;
use App\Domain\Sales\Actions\RefundSaleAction;
use App\Domain\Sales\Exceptions\InvalidSalePaymentException;
use App\Domain\Sales\Exceptions\SaleAlreadyProcessedException;
use App\Models\CashAccount;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Sale;
use App\Models\StockMovement;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\BusinessSettingsSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SaleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(BusinessSettingsSeeder::class);
    }

    private function stockedProduct(Warehouse $warehouse, float $qty = 50, float $cost = 10): Product
    {
        $product = Product::factory()->create(['sale_price' => 25]);
        app(RecordStockMovementAction::class)->execute($product, $warehouse, StockMovement::TYPE_OPENING, $qty, $cost);

        return $product;
    }

    public function test_fully_paid_walk_in_sale_deducts_stock_and_credits_cash(): void
    {
        $warehouse = Warehouse::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $product = $this->stockedProduct($warehouse);
        $user = User::factory()->create();

        $sale = app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id],
            items: [['product_id' => $product->id, 'quantity' => 5, 'unit_id' => $product->unit_id, 'unit_price' => 25]],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 125]],
            cashierId: $user->id,
        );

        $this->assertEquals(125.0, (float) $sale->grand_total);
        $this->assertEquals(0.0, (float) $sale->due_amount);

        $stock = $product->stocks()->where('warehouse_id', $warehouse->id)->first();
        $this->assertEquals(45.0, (float) $stock->quantity);
        $this->assertEquals(125.0, $cashAccount->fresh()->currentBalance());
    }

    public function test_walk_in_sale_must_be_paid_in_full(): void
    {
        $warehouse = Warehouse::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $product = $this->stockedProduct($warehouse);
        $user = User::factory()->create();

        $this->expectException(InvalidSalePaymentException::class);
        app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id],
            items: [['product_id' => $product->id, 'quantity' => 5, 'unit_id' => $product->unit_id, 'unit_price' => 25]],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 50]],
            cashierId: $user->id,
        );
    }

    public function test_customer_credit_sale_with_no_payment_debits_customer_full_amount(): void
    {
        $warehouse = Warehouse::factory()->create();
        $customer = Customer::factory()->create();
        $product = $this->stockedProduct($warehouse);
        $user = User::factory()->create();

        $sale = app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id, 'customer_id' => $customer->id],
            items: [['product_id' => $product->id, 'quantity' => 2, 'unit_id' => $product->unit_id, 'unit_price' => 25]],
            payments: [],
            cashierId: $user->id,
        );

        $this->assertEquals(50.0, (float) $sale->due_amount);
        $this->assertEquals(50.0, $customer->fresh()->currentBalance());
    }

    public function test_customer_partial_payment_leaves_correct_due_and_customer_balance(): void
    {
        $warehouse = Warehouse::factory()->create();
        $customer = Customer::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $product = $this->stockedProduct($warehouse);
        $user = User::factory()->create();

        $sale = app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id, 'customer_id' => $customer->id],
            items: [['product_id' => $product->id, 'quantity' => 4, 'unit_id' => $product->unit_id, 'unit_price' => 25]],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 40]],
            cashierId: $user->id,
        );

        // grand_total 100, paid 40, due 60.
        $this->assertEquals(60.0, (float) $sale->due_amount);
        $this->assertEquals(60.0, $customer->fresh()->currentBalance());
        $this->assertEquals(40.0, $cashAccount->fresh()->currentBalance());
    }

    public function test_selling_more_than_available_stock_throws(): void
    {
        $warehouse = Warehouse::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $product = $this->stockedProduct($warehouse, qty: 3);
        $user = User::factory()->create();

        $this->expectException(InsufficientStockException::class);
        app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id],
            items: [['product_id' => $product->id, 'quantity' => 10, 'unit_id' => $product->unit_id, 'unit_price' => 25]],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 250]],
            cashierId: $user->id,
        );
    }

    public function test_refunding_a_partially_paid_sale_reverses_stock_cash_and_customer_balance(): void
    {
        $warehouse = Warehouse::factory()->create();
        $customer = Customer::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $product = $this->stockedProduct($warehouse);
        $user = User::factory()->create();

        $sale = app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id, 'customer_id' => $customer->id],
            items: [['product_id' => $product->id, 'quantity' => 4, 'unit_id' => $product->unit_id, 'unit_price' => 25]],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 40]],
            cashierId: $user->id,
        );

        app(RefundSaleAction::class)->execute($sale, $user->id);

        $stock = $product->stocks()->where('warehouse_id', $warehouse->id)->first();
        $this->assertEquals(50.0, (float) $stock->quantity); // back to original 50
        $this->assertEquals(0.0, $cashAccount->fresh()->currentBalance()); // 40 given, 40 refunded
        $this->assertEquals(0.0, $customer->fresh()->currentBalance()); // net effect fully undone
        $this->assertEquals(Sale::STATUS_REFUNDED, $sale->fresh()->status);
    }

    public function test_refunding_a_single_item_out_of_a_multi_item_sale_only_affects_that_item(): void
    {
        $warehouse = Warehouse::factory()->create();
        $customer = Customer::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $productA = $this->stockedProduct($warehouse);
        $productB = $this->stockedProduct($warehouse);
        $user = User::factory()->create();

        $sale = app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id, 'customer_id' => $customer->id],
            items: [
                ['product_id' => $productA->id, 'quantity' => 2, 'unit_id' => $productA->unit_id, 'unit_price' => 25],
                ['product_id' => $productB->id, 'quantity' => 2, 'unit_id' => $productB->unit_id, 'unit_price' => 25],
            ],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 40]],
            cashierId: $user->id,
        );

        // grand_total 100 (50 + 50), paid 40, due 60.
        $itemA = $sale->items()->where('product_id', $productA->id)->first();

        $refunded = app(RefundSaleAction::class)->execute($sale, $user->id, [
            ['sale_item_id' => $itemA->id, 'quantity' => 2],
        ]);

        // Refund value = 50 (all of item A) -> fraction of grand_total = 0.5.
        // Stock started at 50, sold 2 (-> 48), refund of 2 brings A back to 50;
        // B was never refunded, so it stays at its post-sale level of 48.
        $this->assertEquals(50.0, (float) $productA->stocks()->where('warehouse_id', $warehouse->id)->first()->quantity);
        $this->assertEquals(48.0, (float) $productB->stocks()->where('warehouse_id', $warehouse->id)->first()->quantity);
        $this->assertEquals(20.0, $cashAccount->fresh()->currentBalance()); // 40 paid - 20 refunded (50% of 40)
        $this->assertEquals(30.0, $customer->fresh()->currentBalance()); // 60 due - 30 forgiven (50% of 60)
        $this->assertEquals(Sale::STATUS_PARTIALLY_REFUNDED, $refunded->status);
        $this->assertEquals(20.0, (float) $refunded->paid_amount);
        $this->assertEquals(30.0, (float) $refunded->due_amount);

        // Returning the second item completes the refund.
        $itemB = $sale->items()->where('product_id', $productB->id)->first();
        $fullyRefunded = app(RefundSaleAction::class)->execute($refunded, $user->id, [
            ['sale_item_id' => $itemB->id, 'quantity' => 2],
        ]);

        $this->assertEquals(Sale::STATUS_REFUNDED, $fullyRefunded->status);
        $this->assertEquals(0.0, $cashAccount->fresh()->currentBalance());
        $this->assertEquals(0.0, $customer->fresh()->currentBalance());
    }

    public function test_refunding_more_than_the_remaining_quantity_is_rejected(): void
    {
        $warehouse = Warehouse::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $product = $this->stockedProduct($warehouse);
        $user = User::factory()->create();

        $sale = app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id],
            items: [['product_id' => $product->id, 'quantity' => 2, 'unit_id' => $product->unit_id, 'unit_price' => 25]],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 50]],
            cashierId: $user->id,
        );
        $item = $sale->items()->first();

        $this->expectException(\App\Domain\Sales\Exceptions\InvalidRefundException::class);
        app(RefundSaleAction::class)->execute($sale, $user->id, [
            ['sale_item_id' => $item->id, 'quantity' => 3],
        ]);
    }

    public function test_manager_can_partially_refund_a_sale_via_api(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $manager->assignRole('manager');

        $warehouse = Warehouse::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $product = $this->stockedProduct($warehouse);

        $sale = app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id],
            items: [['product_id' => $product->id, 'quantity' => 4, 'unit_id' => $product->unit_id, 'unit_price' => 25]],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 100]],
            cashierId: $manager->id,
        );
        $item = $sale->items()->first();

        $response = $this->actingAs($manager)->postJson("/api/v1/sales/{$sale->id}/refund", [
            'items' => [
                ['sale_item_id' => $item->id, 'quantity' => 1],
            ],
        ]);

        $response->assertOk()->assertJsonPath('data.status', Sale::STATUS_PARTIALLY_REFUNDED);
    }

    public function test_cannot_refund_an_already_refunded_sale(): void
    {
        $warehouse = Warehouse::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $product = $this->stockedProduct($warehouse);
        $user = User::factory()->create();

        $sale = app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id],
            items: [['product_id' => $product->id, 'quantity' => 1, 'unit_id' => $product->unit_id, 'unit_price' => 25]],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 25]],
            cashierId: $user->id,
        );
        app(RefundSaleAction::class)->execute($sale, $user->id);

        $this->expectException(SaleAlreadyProcessedException::class);
        app(RefundSaleAction::class)->execute($sale->fresh(), $user->id);
    }

    public function test_cashier_can_create_sale_via_api(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $cashier = User::factory()->create();
        $cashier->assignRole('cashier');

        $warehouse = Warehouse::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $product = $this->stockedProduct($warehouse);

        $response = $this->actingAs($cashier)->postJson('/api/v1/sales', [
            'warehouse_id' => $warehouse->id,
            'items' => [
                ['product_id' => $product->id, 'quantity' => 2, 'unit_id' => $product->unit_id, 'unit_price' => 25],
            ],
            'payments' => [
                ['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 50],
            ],
        ]);

        $response->assertCreated()->assertJsonPath('data.due_amount', 0);
    }

    public function test_cashier_only_sees_their_own_sales_in_the_list(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $warehouse = Warehouse::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $product = $this->stockedProduct($warehouse, 50);

        $cashierA = User::factory()->create();
        $cashierA->assignRole('cashier');
        $cashierB = User::factory()->create();
        $cashierB->assignRole('cashier');

        $saleA = app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id],
            items: [['product_id' => $product->id, 'quantity' => 1, 'unit_id' => $product->unit_id, 'unit_price' => 25]],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 25]],
            cashierId: $cashierA->id,
        );
        app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id],
            items: [['product_id' => $product->id, 'quantity' => 1, 'unit_id' => $product->unit_id, 'unit_price' => 25]],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 25]],
            cashierId: $cashierB->id,
        );

        $response = $this->actingAs($cashierA)->getJson('/api/v1/sales')->assertOk();
        $ids = collect($response->json('data'))->pluck('id');
        $this->assertEquals([$saleA->id], $ids->all());
    }

    public function test_cashier_cannot_view_another_cashiers_sale_detail(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $warehouse = Warehouse::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $product = $this->stockedProduct($warehouse, 50);

        $cashierA = User::factory()->create();
        $cashierA->assignRole('cashier');
        $cashierB = User::factory()->create();
        $cashierB->assignRole('cashier');

        $saleB = app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id],
            items: [['product_id' => $product->id, 'quantity' => 1, 'unit_id' => $product->unit_id, 'unit_price' => 25]],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 25]],
            cashierId: $cashierB->id,
        );

        $this->actingAs($cashierA)->getJson("/api/v1/sales/{$saleB->id}")->assertForbidden();
        $this->actingAs($cashierB)->getJson("/api/v1/sales/{$saleB->id}")->assertOk();
    }

    public function test_sale_invoice_pdf_renders(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $manager->assignRole('manager');

        $warehouse = Warehouse::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $product = $this->stockedProduct($warehouse);

        $sale = app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id],
            items: [['product_id' => $product->id, 'quantity' => 2, 'unit_id' => $product->unit_id, 'unit_price' => 25]],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 50]],
            cashierId: $manager->id,
        );

        $response = $this->actingAs($manager)->get("/api/v1/sales/{$sale->id}/pdf");

        $response->assertOk();
        $this->assertSame('application/pdf', $response->headers->get('Content-Type'));
    }

    public function test_sales_list_can_be_filtered_by_date_range(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $manager->assignRole('manager');

        $warehouse = Warehouse::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $product = $this->stockedProduct($warehouse);

        app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id, 'sale_date' => now()->subDays(10)],
            items: [['product_id' => $product->id, 'quantity' => 1, 'unit_id' => $product->unit_id, 'unit_price' => 25]],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 25]],
            cashierId: $manager->id,
        );
        app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id, 'sale_date' => now()],
            items: [['product_id' => $product->id, 'quantity' => 1, 'unit_id' => $product->unit_id, 'unit_price' => 25]],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 25]],
            cashierId: $manager->id,
        );

        $response = $this->actingAs($manager)->getJson(
            '/api/v1/sales?filter[from]='.now()->subDays(2)->toDateString().'&filter[to]='.now()->toDateString()
        )->assertOk();

        $this->assertCount(1, $response->json('data'));
    }

    public function test_sale_item_exposes_unit_and_total_cost(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $manager->assignRole('manager');

        $warehouse = Warehouse::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $product = $this->stockedProduct($warehouse, qty: 50, cost: 10);

        $sale = app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id],
            items: [['product_id' => $product->id, 'quantity' => 4, 'unit_id' => $product->unit_id, 'unit_price' => 25]],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 100]],
            cashierId: $manager->id,
        );

        $response = $this->actingAs($manager)->getJson("/api/v1/sales/{$sale->id}")->assertOk();
        $item = $response->json('data.items.0');

        $this->assertEquals(10.0, $item['cost_price_snapshot']);
        $this->assertEquals(40.0, $item['total_cost']); // 4 units @ 10 landed unit cost
    }

    public function test_manager_sees_all_sales_regardless_of_cashier(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $warehouse = Warehouse::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $product = $this->stockedProduct($warehouse, 50);

        $cashier = User::factory()->create();
        $cashier->assignRole('cashier');
        $manager = User::factory()->create();
        $manager->assignRole('manager');

        $sale = app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id],
            items: [['product_id' => $product->id, 'quantity' => 1, 'unit_id' => $product->unit_id, 'unit_price' => 25]],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 25]],
            cashierId: $cashier->id,
        );

        $this->actingAs($manager)->getJson("/api/v1/sales/{$sale->id}")->assertOk();
        $response = $this->actingAs($manager)->getJson('/api/v1/sales')->assertOk();
        $this->assertCount(1, $response->json('data'));
    }
}
