<?php

namespace Tests\Feature\Reports;

use App\Domain\Employees\Actions\CreatePayrollRunAction;
use App\Domain\Employees\Actions\PayPayrollRunAction;
use App\Domain\Expenses\Actions\CreateExpenseAction;
use App\Domain\Inventory\Actions\RecordStockMovementAction;
use App\Domain\Payments\Actions\RecordPaymentAction;
use App\Domain\Purchases\Actions\CreatePurchaseAction;
use App\Domain\Purchases\Actions\ReceivePurchaseAction;
use App\Domain\Sales\Actions\CreateSaleAction;
use App\Domain\Sales\Actions\RefundSaleAction;
use App\Models\CashAccount;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\ExpenseCategory;
use App\Models\Payment;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\BusinessSettingsSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RolesAndPermissionsSeeder::class, BusinessSettingsSeeder::class]);
    }

    private function manager(): User
    {
        $manager = User::factory()->create();
        $this->grantRole($manager, 'manager');

        return $manager;
    }

    public function test_profit_loss_reflects_sales_cogs_expenses_and_payroll(): void
    {
        $warehouse = Warehouse::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $cashier = User::factory()->create();

        $product = Product::factory()->create(['sale_price' => 25]);
        app(RecordStockMovementAction::class)->execute($product, $warehouse, StockMovement::TYPE_OPENING, 50, 10);

        // Revenue 250, COGS 100 -> gross profit 150.
        app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id],
            items: [['product_id' => $product->id, 'quantity' => 10, 'unit_id' => $product->unit_id, 'unit_price' => 25]],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 250]],
            cashierId: $cashier->id,
        );

        // Operating expense of 20.
        $category = ExpenseCategory::factory()->create(['is_landed_cost_type' => false]);
        app(CreateExpenseAction::class)->execute([
            'expense_category_id' => $category->id,
            'cash_account_id' => $cashAccount->id,
            'amount' => 20,
            'expense_date' => now(),
            'is_landed_cost' => false,
        ], $cashier->id);

        // Payroll: one employee paid this month, net pay 500.
        $employee = Employee::factory()->create(['salary_amount' => 500]);
        $run = app(CreatePayrollRunAction::class)->execute((int) now()->month, (int) now()->year, $cashier->id);
        app(PayPayrollRunAction::class)->execute($run, $cashAccount, $cashier->id);

        $response = $this->actingAs($this->manager())
            ->getJson('/api/v1/reports/profit-loss?from='.now()->startOfMonth()->toDateString().'&to='.now()->endOfMonth()->toDateString())
            ->assertOk();

        $response->assertJson([
            'revenue' => 250.0,
            'discounts' => 0.0,
            'net_revenue' => 250.0,
            'cogs' => 100.0,
            'gross_profit' => 150.0,
            'operating_expenses' => 20.0,
            'payroll_cost' => 500.0,
            'net_profit' => -370.0,
        ]);
    }

    /**
     * A discount taken off the whole sale is money the shop chose not to
     * take. It never appeared in line totals, so revenue was reported as if
     * it had been charged in full and every figure below it was too high.
     */
    public function test_a_discount_on_the_sale_comes_off_the_revenue_and_the_profit(): void
    {
        $warehouse = Warehouse::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $cashier = User::factory()->create();
        $product = Product::factory()->create(['sale_price' => 100, 'default_cost' => 60]);

        app(RecordStockMovementAction::class)->execute($product, $warehouse, StockMovement::TYPE_OPENING, 10, 60);

        // Sold for 200, with 50 taken off at the till.
        app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id, 'sale_date' => now(), 'discount' => 50],
            items: [[
                'product_id' => $product->id, 'quantity' => 2,
                'unit_id' => $product->unit_id, 'unit_price' => 100,
            ]],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 150]],
            cashierId: $cashier->id,
        );

        $this->actingAs($this->manager())
            ->getJson('/api/v1/reports/profit-loss?from='.now()->startOfMonth()->toDateString().'&to='.now()->endOfMonth()->toDateString())
            ->assertOk()
            ->assertJson([
                'revenue' => 200.0,
                'discounts' => 50.0,
                'net_revenue' => 150.0,
                'cogs' => 120.0,
                // 150 taken, 120 of stock gone: thirty pounds of profit, not
                // the eighty it used to claim.
                'gross_profit' => 30.0,
                'net_profit' => 30.0,
            ]);
    }

    /**
     * Wages are paid on a handful of days a month. The journal reports them
     * on those days and stays silent on the rest, rather than printing a
     * zero every day of the year.
     */
    public function test_the_journal_reports_salaries_only_on_the_day_they_were_paid(): void
    {
        $cashAccount = CashAccount::factory()->create();
        $cashier = User::factory()->create();
        Employee::factory()->create(['salary_amount' => 500]);

        $run = app(CreatePayrollRunAction::class)->execute((int) now()->month, (int) now()->year, $cashier->id);
        app(PayPayrollRunAction::class)->execute($run, $cashAccount, $cashier->id);

        $this->actingAs($this->manager())
            ->getJson('/api/v1/reports/daily-journal?date='.now()->toDateString())
            ->assertOk()
            ->assertJsonPath('salaries_total', fn ($v) => (float) $v === 500.0)
            // Wages paid today are today's cost, so the day is down by them.
            ->assertJsonPath('profit_or_loss', fn ($v) => (float) $v === -500.0);

        // A day nobody was paid reports nothing, and the screen shows no tile.
        $this->actingAs($this->manager())
            ->getJson('/api/v1/reports/daily-journal?date='.now()->subDay()->toDateString())
            ->assertOk()
            ->assertJsonPath('salaries_total', fn ($v) => (float) $v === 0.0);
    }

    public function test_a_sale_reports_what_it_actually_earned(): void
    {
        $warehouse = Warehouse::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $cashier = User::factory()->create();
        $product = Product::factory()->create(['sale_price' => 100, 'default_cost' => 60]);

        app(RecordStockMovementAction::class)->execute($product, $warehouse, StockMovement::TYPE_OPENING, 10, 60);

        $sale = app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id, 'sale_date' => now(), 'discount' => 40],
            items: [[
                'product_id' => $product->id, 'quantity' => 3,
                'unit_id' => $product->unit_id, 'unit_price' => 100,
            ]],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 260]],
            cashierId: $cashier->id,
        );

        // 300 rung up, 40 off, 180 of stock gone: eighty earned.
        $this->actingAs($this->manager())
            ->getJson('/api/v1/sales/'.$sale->id)
            ->assertOk()
            ->assertJsonPath('data.cost_total', fn ($v) => (float) $v === 180.0)
            ->assertJsonPath('data.profit', fn ($v) => (float) $v === 80.0);
    }

    public function test_the_sales_summary_reports_the_profit_for_each_period(): void
    {
        $warehouse = Warehouse::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $cashier = User::factory()->create();
        $product = Product::factory()->create(['sale_price' => 100, 'default_cost' => 60]);

        app(RecordStockMovementAction::class)->execute($product, $warehouse, StockMovement::TYPE_OPENING, 10, 60);

        app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id, 'sale_date' => now(), 'discount' => 40],
            items: [[
                'product_id' => $product->id, 'quantity' => 3,
                'unit_id' => $product->unit_id, 'unit_price' => 100,
            ]],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 260]],
            cashierId: $cashier->id,
        );

        $rows = $this->actingAs($this->manager())
            ->getJson('/api/v1/reports/sales-summary?from='.now()->toDateString().'&to='.now()->toDateString())
            ->assertOk()
            ->json('rows');

        $this->assertCount(1, $rows);
        $this->assertEqualsWithDelta(300.0, $rows[0]['total'], 0.001);
        $this->assertEqualsWithDelta(40.0, $rows[0]['discount'], 0.001);
        $this->assertEqualsWithDelta(180.0, $rows[0]['cost'], 0.001);
        $this->assertEqualsWithDelta(80.0, $rows[0]['profit'], 0.001);
    }

    public function test_the_daily_journal_also_takes_the_discount_off_the_day(): void
    {
        $warehouse = Warehouse::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $cashier = User::factory()->create();
        $product = Product::factory()->create(['sale_price' => 100, 'default_cost' => 60]);

        app(RecordStockMovementAction::class)->execute($product, $warehouse, StockMovement::TYPE_OPENING, 10, 60);

        app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id, 'sale_date' => now(), 'discount' => 50],
            items: [[
                'product_id' => $product->id, 'quantity' => 2,
                'unit_id' => $product->unit_id, 'unit_price' => 100,
            ]],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 150]],
            cashierId: $cashier->id,
        );

        $this->actingAs($this->manager())
            ->getJson('/api/v1/reports/daily-journal?date='.now()->toDateString())
            ->assertOk()
            ->assertJson([
                'sales_total' => 200.0,
                'discounts_total' => 50.0,
                'profit_or_loss' => 30.0,
            ]);
    }

    public function test_profit_loss_nets_out_a_partial_refund_and_excludes_a_full_refund(): void
    {
        $warehouse = Warehouse::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $cashier = User::factory()->create();

        $productA = Product::factory()->create(['sale_price' => 25]);
        app(RecordStockMovementAction::class)->execute($productA, $warehouse, StockMovement::TYPE_OPENING, 50, 10);
        $productB = Product::factory()->create(['sale_price' => 25]);
        app(RecordStockMovementAction::class)->execute($productB, $warehouse, StockMovement::TYPE_OPENING, 50, 10);

        // Sale 1: two products, 10 units each @ 25 (cost 10) -> revenue 500, cogs 200.
        $sale1 = app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id],
            items: [
                ['product_id' => $productA->id, 'quantity' => 10, 'unit_id' => $productA->unit_id, 'unit_price' => 25],
                ['product_id' => $productB->id, 'quantity' => 10, 'unit_id' => $productB->unit_id, 'unit_price' => 25],
            ],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 500]],
            cashierId: $cashier->id,
        );

        // Sale 2: a separate, fully refunded sale must vanish from the report entirely.
        $sale2 = app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id],
            items: [['product_id' => $productA->id, 'quantity' => 4, 'unit_id' => $productA->unit_id, 'unit_price' => 25]],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 100]],
            cashierId: $cashier->id,
        );

        $itemA = $sale1->items()->where('product_id', $productA->id)->first();
        app(RefundSaleAction::class)->execute($sale1, $cashier->id, [
            ['sale_item_id' => $itemA->id, 'quantity' => 10],
        ]);
        app(RefundSaleAction::class)->execute($sale2, $cashier->id);

        $response = $this->actingAs($this->manager())
            ->getJson('/api/v1/reports/profit-loss?from='.now()->startOfMonth()->toDateString().'&to='.now()->endOfMonth()->toDateString())
            ->assertOk();

        // Only product B's 10 units survive: revenue 250, cogs 100, profit 150.
        // Sale 1's returned product A and sale 2 (fully refunded) contribute nothing.
        $response->assertJson([
            'revenue' => 250.0,
            'cogs' => 100.0,
            'gross_profit' => 150.0,
        ]);
    }

    public function test_profit_loss_classifies_operating_expenses_by_category(): void
    {
        $cashAccount = CashAccount::factory()->create();
        $cashier = User::factory()->create();

        $rent = ExpenseCategory::factory()->create(['name' => 'Rent', 'is_landed_cost_type' => false]);
        $utilities = ExpenseCategory::factory()->create(['name' => 'Utilities', 'is_landed_cost_type' => false]);
        $landedCostCategory = ExpenseCategory::factory()->create(['name' => 'Freight', 'is_landed_cost_type' => true]);

        app(CreateExpenseAction::class)->execute([
            'expense_category_id' => $rent->id,
            'cash_account_id' => $cashAccount->id,
            'amount' => 100,
            'expense_date' => now(),
            'is_landed_cost' => false,
        ], $cashier->id);

        app(CreateExpenseAction::class)->execute([
            'expense_category_id' => $utilities->id,
            'cash_account_id' => $cashAccount->id,
            'amount' => 40,
            'expense_date' => now(),
            'is_landed_cost' => false,
        ], $cashier->id);

        // Landed costs must be excluded from operating expenses entirely.
        app(CreateExpenseAction::class)->execute([
            'expense_category_id' => $landedCostCategory->id,
            'cash_account_id' => $cashAccount->id,
            'amount' => 999,
            'expense_date' => now(),
            'is_landed_cost' => true,
        ], $cashier->id);

        $response = $this->actingAs($this->manager())
            ->getJson('/api/v1/reports/profit-loss?from='.now()->startOfMonth()->toDateString().'&to='.now()->endOfMonth()->toDateString())
            ->assertOk();

        $this->assertEquals(140.0, $response->json('operating_expenses'));

        $byCategory = collect($response->json('operating_expenses_by_category'));
        $this->assertCount(2, $byCategory);
        $this->assertEquals('Rent', $byCategory->first()['category']); // sorted descending by total
        $this->assertEquals(100.0, $byCategory->first()['total']);
        $this->assertEquals(40.0, $byCategory->firstWhere('category', 'Utilities')['total']);
        $this->assertFalse($byCategory->contains('category', 'Freight'));
    }

    public function test_inventory_valuation_sums_quantity_times_average_cost(): void
    {
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();
        app(RecordStockMovementAction::class)->execute($product, $warehouse, StockMovement::TYPE_OPENING, 20, 15);

        $response = $this->actingAs($this->manager())
            ->getJson('/api/v1/reports/inventory-valuation')
            ->assertOk();

        $response->assertJson(['total_value' => 300.0]);
    }

    public function test_expenses_by_category_groups_and_sums(): void
    {
        $cashAccount = CashAccount::factory()->create();
        $cashier = User::factory()->create();
        $category = ExpenseCategory::factory()->create(['name' => 'Rent']);

        app(CreateExpenseAction::class)->execute([
            'expense_category_id' => $category->id,
            'cash_account_id' => $cashAccount->id,
            'amount' => 50,
            'expense_date' => now(),
        ], $cashier->id);

        app(CreateExpenseAction::class)->execute([
            'expense_category_id' => $category->id,
            'cash_account_id' => $cashAccount->id,
            'amount' => 30,
            'expense_date' => now(),
        ], $cashier->id);

        $response = $this->actingAs($this->manager())
            ->getJson('/api/v1/reports/expenses-by-category?from='.now()->startOfMonth()->toDateString().'&to='.now()->endOfMonth()->toDateString())
            ->assertOk();

        $response->assertJsonFragment(['category' => 'Rent', 'total' => 80.0]);
    }

    public function test_sales_summary_groups_completed_sales_by_day(): void
    {
        $warehouse = Warehouse::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $cashier = User::factory()->create();
        $product = Product::factory()->create(['sale_price' => 25]);
        app(RecordStockMovementAction::class)->execute($product, $warehouse, StockMovement::TYPE_OPENING, 50, 10);

        app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id],
            items: [['product_id' => $product->id, 'quantity' => 2, 'unit_id' => $product->unit_id, 'unit_price' => 25]],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 50]],
            cashierId: $cashier->id,
        );

        $response = $this->actingAs($this->manager())
            ->getJson('/api/v1/reports/sales-summary?from='.now()->startOfMonth()->toDateString().'&to='.now()->endOfMonth()->toDateString())
            ->assertOk();

        $response->assertJsonFragment(['sale_count' => 1, 'total' => 50.0]);
    }

    public function test_cashier_is_forbidden_from_reports(): void
    {
        $cashier = User::factory()->create();
        $this->grantRole($cashier, 'cashier');

        $this->actingAs($cashier)
            ->getJson('/api/v1/reports/profit-loss')
            ->assertForbidden();
    }

    public function test_receivables_lists_only_customers_who_owe_the_shop(): void
    {
        Customer::factory()->create(['name' => 'Owes Us', 'opening_balance' => 300, 'opening_balance_type' => 'debit']);
        Customer::factory()->create(['name' => 'Settled', 'opening_balance' => 0]);

        $response = $this->actingAs($this->manager())->getJson('/api/v1/reports/receivables')->assertOk();

        $response->assertJsonFragment(['name' => 'Owes Us', 'balance' => 300.0]);
        $response->assertJsonMissing(['name' => 'Settled']);
        $this->assertEquals(300.0, $response->json('total'));
    }

    public function test_payables_lists_only_suppliers_the_shop_owes(): void
    {
        Supplier::factory()->create(['name' => 'We Owe', 'opening_balance' => 400, 'opening_balance_type' => 'credit']);
        Supplier::factory()->create(['name' => 'No Balance', 'opening_balance' => 0]);

        $response = $this->actingAs($this->manager())->getJson('/api/v1/reports/payables')->assertOk();

        $response->assertJsonFragment(['name' => 'We Owe', 'balance' => 400.0]);
        $response->assertJsonMissing(['name' => 'No Balance']);
        $this->assertEquals(400.0, $response->json('total'));
    }

    public function test_all_report_pdfs_render_valid_documents(): void
    {
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();
        app(RecordStockMovementAction::class)->execute($product, $warehouse, StockMovement::TYPE_OPENING, 5, 10);
        Customer::factory()->create(['opening_balance' => 100, 'opening_balance_type' => 'debit']);
        Supplier::factory()->create(['opening_balance' => 50, 'opening_balance_type' => 'credit']);
        $cashAccount = CashAccount::factory()->create();

        $manager = $this->manager();

        foreach ([
            '/api/v1/reports/profit-loss/pdf',
            '/api/v1/reports/inventory-valuation/pdf',
            '/api/v1/reports/sales-summary/pdf',
            '/api/v1/reports/purchase-summary/pdf',
            '/api/v1/reports/expenses-by-category/pdf',
            '/api/v1/reports/receivables/pdf',
            '/api/v1/reports/payables/pdf',
            '/api/v1/reports/daily-journal/pdf',
            "/api/v1/cash-accounts/{$cashAccount->id}/ledger/pdf",
        ] as $url) {
            $response = $this->actingAs($manager)->get($url)->assertOk();
            $this->assertSame('application/pdf', $response->headers->get('Content-Type'));
            $this->assertStringStartsWith('%PDF-', $response->getContent());
        }
    }

    public function test_profit_loss_includes_current_balance_sheet_snapshot(): void
    {
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();
        app(RecordStockMovementAction::class)->execute($product, $warehouse, StockMovement::TYPE_OPENING, 10, 20);

        CashAccount::factory()->create(['opening_balance' => 500]);
        Customer::factory()->create(['opening_balance' => 300, 'opening_balance_type' => 'debit']);
        Supplier::factory()->create(['opening_balance' => 150, 'opening_balance_type' => 'credit']);

        $response = $this->actingAs($this->manager())
            ->getJson('/api/v1/reports/profit-loss?from='.now()->startOfMonth()->toDateString().'&to='.now()->endOfMonth()->toDateString())
            ->assertOk();

        // Stock: 10 units @ 20 = 200. Cash: opening balance 500 (no other
        // movements this test). Receivables/payables come straight from
        // the same opening balances used elsewhere in this file.
        $response->assertJson([
            'cash_balance' => 500.0,
            'inventory_value' => 200.0,
            'receivables_total' => 300.0,
            'payables_total' => 150.0,
        ]);
    }

    public function test_purchase_summary_only_counts_received_purchases_grouped_by_day(): void
    {
        $supplier = Supplier::factory()->create();
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();
        $unit = Unit::factory()->create();
        $manager = $this->manager();

        // Received: counts, at its full grand total.
        $received = app(CreatePurchaseAction::class)->execute(
            data: ['supplier_id' => $supplier->id, 'warehouse_id' => $warehouse->id, 'purchase_date' => now()],
            items: [['product_id' => $product->id, 'quantity' => 5, 'unit_id' => $unit->id, 'unit_cost' => 20]],
            landedCosts: [],
            createdBy: $manager->id,
        );
        app(ReceivePurchaseAction::class)->execute($received, $manager->id);

        // Draft: not yet real spend, must be excluded.
        app(CreatePurchaseAction::class)->execute(
            data: ['supplier_id' => $supplier->id, 'warehouse_id' => $warehouse->id, 'purchase_date' => now()],
            items: [['product_id' => $product->id, 'quantity' => 100, 'unit_id' => $unit->id, 'unit_cost' => 20]],
            landedCosts: [],
            createdBy: $manager->id,
        );

        $response = $this->actingAs($manager)
            ->getJson('/api/v1/reports/purchase-summary?from='.now()->startOfMonth()->toDateString().'&to='.now()->endOfMonth()->toDateString())
            ->assertOk();

        $response->assertJsonFragment(['purchase_count' => 1, 'total' => 100.0]);
        $this->assertEquals(100.0, collect($response->json('rows'))->sum('total'));
    }

    public function test_daily_journal_aggregates_the_days_sales_purchases_payments_and_expenses(): void
    {
        $warehouse = Warehouse::factory()->create();
        $cashAccount = CashAccount::factory()->create(['opening_balance' => 0]);
        $cashier = User::factory()->create();
        $customer = Customer::factory()->create();
        $supplier = Supplier::factory()->create();
        $unit = Unit::factory()->create();

        $product = Product::factory()->create(['sale_price' => 100]);
        app(RecordStockMovementAction::class)->execute($product, $warehouse, StockMovement::TYPE_OPENING, 10, 40);

        // Credit sale: total 100, only 60 tendered -> 40 stays on the customer's account.
        app(CreateSaleAction::class)->execute(
            data: ['customer_id' => $customer->id, 'warehouse_id' => $warehouse->id],
            items: [['product_id' => $product->id, 'quantity' => 1, 'unit_id' => $product->unit_id, 'unit_price' => 100]],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 60]],
            cashierId: $cashier->id,
        );

        // The customer pays down 40 of what they owe.
        app(RecordPaymentAction::class)->execute(
            party: $customer,
            direction: Payment::DIRECTION_IN,
            amount: 40,
            cashAccount: $cashAccount,
            method: 'cash',
            description: null,
            reference: null,
            receivedBy: $cashier->id,
        );

        // A received purchase (unpaid — pure A/P, no cash movement).
        $purchase = app(CreatePurchaseAction::class)->execute(
            data: ['supplier_id' => $supplier->id, 'warehouse_id' => $warehouse->id, 'purchase_date' => now()],
            items: [['product_id' => $product->id, 'quantity' => 5, 'unit_id' => $unit->id, 'unit_cost' => 10]],
            landedCosts: [],
            createdBy: $cashier->id,
        );
        app(ReceivePurchaseAction::class)->execute($purchase, $cashier->id);

        // Paying the supplier down by 20.
        app(RecordPaymentAction::class)->execute(
            party: $supplier,
            direction: Payment::DIRECTION_OUT,
            amount: 20,
            cashAccount: $cashAccount,
            method: 'cash',
            description: null,
            reference: null,
            receivedBy: $cashier->id,
        );

        // A same-day operating expense of 10, paid from the same cash account.
        $category = ExpenseCategory::factory()->create(['is_landed_cost_type' => false]);
        app(CreateExpenseAction::class)->execute([
            'expense_category_id' => $category->id,
            'cash_account_id' => $cashAccount->id,
            'amount' => 10,
            'expense_date' => now(),
            'is_landed_cost' => false,
        ], $cashier->id);

        $response = $this->actingAs($this->manager())
            ->getJson('/api/v1/reports/daily-journal')
            ->assertOk();

        $response->assertJson([
            'sales_total' => 100.0,
            'credit_sales_total' => 40.0,
            'customer_collections_total' => 40.0,
            'purchases_total' => 50.0,
            'supplier_payments_total' => 20.0,
            'expenses_total' => 10.0,
            // Cash in: 60 (sale) + 40 (collection) = 100. Cash out: 20 (supplier) + 10 (expense) = 30.
            'cash_in_total' => 100.0,
            'cash_out_total' => 30.0,
            'net_cash_movement' => 70.0,
            // Revenue 100 - cogs (1 unit @ 40) - operating expenses 10 = 50.
            'profit_or_loss' => 50.0,
        ]);

        $this->assertCount(5, $response->json('transactions'));
    }

    public function test_cash_account_ledger_lists_entries_with_running_balance(): void
    {
        $cashAccount = CashAccount::factory()->create(['opening_balance' => 1000]);
        $supplier = Supplier::factory()->create();
        $manager = $this->manager();

        app(RecordPaymentAction::class)->execute(
            party: $supplier,
            direction: Payment::DIRECTION_OUT,
            amount: 200,
            cashAccount: $cashAccount,
            method: 'cash',
            description: 'Supplier payment',
            reference: null,
            receivedBy: $manager->id,
        );

        $response = $this->actingAs($manager)
            ->getJson("/api/v1/cash-accounts/{$cashAccount->id}/ledger")
            ->assertOk();

        // Opening balance (debit, +1000) then a 200 cash-out (credit) ->
        // current balance settles at 800.
        $this->assertEquals(800.0, $response->json('current_balance'));
        $response->assertJsonFragment(['entry_type' => 'credit', 'amount' => 200.0]);
    }
}
