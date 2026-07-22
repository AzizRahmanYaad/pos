<?php

namespace Tests\Feature\Reports;

use App\Domain\Employees\Actions\CreatePayrollRunAction;
use App\Domain\Employees\Actions\PayPayrollRunAction;
use App\Domain\Expenses\Actions\CreateExpenseAction;
use App\Domain\Inventory\Actions\RecordStockMovementAction;
use App\Domain\Sales\Actions\CreateSaleAction;
use App\Models\CashAccount;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\ExpenseCategory;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Supplier;
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
        $manager->assignRole('manager');

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
            'cogs' => 100.0,
            'gross_profit' => 150.0,
            'operating_expenses' => 20.0,
            'payroll_cost' => 500.0,
            'net_profit' => -370.0,
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
        $cashier->assignRole('cashier');

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

        $manager = $this->manager();

        foreach ([
            '/api/v1/reports/profit-loss/pdf',
            '/api/v1/reports/inventory-valuation/pdf',
            '/api/v1/reports/sales-summary/pdf',
            '/api/v1/reports/expenses-by-category/pdf',
            '/api/v1/reports/receivables/pdf',
            '/api/v1/reports/payables/pdf',
        ] as $url) {
            $response = $this->actingAs($manager)->get($url)->assertOk();
            $this->assertSame('application/pdf', $response->headers->get('Content-Type'));
            $this->assertStringStartsWith('%PDF-', $response->getContent());
        }
    }
}
