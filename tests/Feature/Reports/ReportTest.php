<?php

namespace Tests\Feature\Reports;

use App\Domain\Employees\Actions\CreatePayrollRunAction;
use App\Domain\Employees\Actions\PayPayrollRunAction;
use App\Domain\Expenses\Actions\CreateExpenseAction;
use App\Domain\Inventory\Actions\RecordStockMovementAction;
use App\Domain\Sales\Actions\CreateSaleAction;
use App\Models\CashAccount;
use App\Models\Employee;
use App\Models\ExpenseCategory;
use App\Models\Product;
use App\Models\StockMovement;
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
}
