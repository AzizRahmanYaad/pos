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
}
