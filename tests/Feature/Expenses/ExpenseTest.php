<?php

namespace Tests\Feature\Expenses;

use App\Domain\Expenses\Actions\CreateExpenseAction;
use App\Domain\Expenses\Exceptions\InvalidExpenseException;
use App\Domain\Purchases\Actions\CreatePurchaseAction;
use App\Domain\Purchases\Actions\ReceivePurchaseAction;
use App\Models\CashAccount;
use App\Models\ExpenseCategory;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\BusinessSettingsSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExpenseTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(BusinessSettingsSeeder::class);
    }

    public function test_creating_a_general_expense_debits_cash_account(): void
    {
        $category = ExpenseCategory::factory()->create();
        $cashAccount = CashAccount::factory()->create(['opening_balance' => 1000]);
        $user = User::factory()->create();

        $expense = app(CreateExpenseAction::class)->execute([
            'expense_category_id' => $category->id,
            'cash_account_id' => $cashAccount->id,
            'amount' => 150,
            'description' => 'Office rent',
        ], $user->id);

        $this->assertEquals(150.0, (float) $expense->amount);
        $this->assertEquals(850.0, $cashAccount->fresh()->currentBalance());
    }

    public function test_landed_cost_expense_attaches_to_draft_purchase_and_updates_landed_total(): void
    {
        $supplier = Supplier::factory()->create();
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $category = ExpenseCategory::factory()->create(['is_landed_cost_type' => true]);
        $user = User::factory()->create();

        $purchase = app(CreatePurchaseAction::class)->execute(
            data: ['supplier_id' => $supplier->id, 'warehouse_id' => $warehouse->id, 'purchase_date' => now()],
            items: [['product_id' => $product->id, 'quantity' => 10, 'unit_id' => $product->unit_id, 'unit_cost' => 10]],
            landedCosts: [],
            createdBy: $user->id,
        );
        $this->assertEquals(0.0, (float) $purchase->landed_cost_total);

        $expense = app(CreateExpenseAction::class)->execute([
            'expense_category_id' => $category->id,
            'cash_account_id' => $cashAccount->id,
            'amount' => 40,
            'description' => 'Transport',
            'is_landed_cost' => true,
            'purchase_id' => $purchase->id,
        ], $user->id);

        $this->assertNotNull($expense->landedCost);
        $this->assertEquals(40.0, (float) $purchase->fresh()->landed_cost_total);

        // Receiving now picks up the landed cost added after creation.
        $received = app(ReceivePurchaseAction::class)->execute($purchase->fresh(), $user->id);
        $stock = $product->stocks()->where('warehouse_id', $warehouse->id)->first();
        // unit_cost 10 + (40/10) = 14
        $this->assertEquals(14.0, (float) $stock->average_cost);
        $this->assertEquals(40.0, (float) $received->landed_cost_total);
    }

    public function test_landed_cost_expense_rejected_for_already_received_purchase(): void
    {
        $supplier = Supplier::factory()->create();
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $category = ExpenseCategory::factory()->create(['is_landed_cost_type' => true]);
        $user = User::factory()->create();

        $purchase = app(CreatePurchaseAction::class)->execute(
            data: ['supplier_id' => $supplier->id, 'warehouse_id' => $warehouse->id, 'purchase_date' => now()],
            items: [['product_id' => $product->id, 'quantity' => 5, 'unit_id' => $product->unit_id, 'unit_cost' => 10]],
            landedCosts: [],
            createdBy: $user->id,
        );
        app(ReceivePurchaseAction::class)->execute($purchase, $user->id);

        $this->expectException(InvalidExpenseException::class);
        app(CreateExpenseAction::class)->execute([
            'expense_category_id' => $category->id,
            'cash_account_id' => $cashAccount->id,
            'amount' => 20,
            'is_landed_cost' => true,
            'purchase_id' => $purchase->id,
        ], $user->id);
    }

    public function test_manager_can_create_expense_via_api(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $manager->assignRole('manager');

        $category = ExpenseCategory::factory()->create();
        $cashAccount = CashAccount::factory()->create();

        $response = $this->actingAs($manager)->postJson('/api/v1/expenses', [
            'expense_category_id' => $category->id,
            'cash_account_id' => $cashAccount->id,
            'amount' => 75,
            'description' => 'Electricity bill',
        ]);

        $response->assertCreated()->assertJsonPath('data.amount', 75);
    }

    public function test_cashier_cannot_create_expense(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $cashier = User::factory()->create();
        $cashier->assignRole('cashier');

        $category = ExpenseCategory::factory()->create();
        $cashAccount = CashAccount::factory()->create();

        $this->actingAs($cashier)->postJson('/api/v1/expenses', [
            'expense_category_id' => $category->id,
            'cash_account_id' => $cashAccount->id,
            'amount' => 20,
        ])->assertForbidden();
    }
}
