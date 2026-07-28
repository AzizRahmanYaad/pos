<?php

namespace Tests\Feature\PeriodClosing;

use App\Domain\Expenses\Actions\CreateExpenseAction;
use App\Domain\Inventory\Actions\RecordStockMovementAction;
use App\Domain\PeriodClosing\Actions\ClosePeriodAction;
use App\Domain\PeriodClosing\Actions\ReopenPeriodAction;
use App\Domain\PeriodClosing\Exceptions\InvalidPeriodClosingException;
use App\Domain\PeriodClosing\Exceptions\PeriodClosedException;
use App\Domain\Sales\Actions\CreateSaleAction;
use App\Models\CashAccount;
use App\Models\Customer;
use App\Models\ExpenseCategory;
use App\Models\PeriodClosing;
use App\Models\PeriodClosingSnapshot;
use App\Models\Product;
use App\Models\User;
use App\Models\Warehouse;
use Carbon\Carbon;
use Database\Seeders\BusinessSettingsSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PeriodClosingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(BusinessSettingsSeeder::class);
    }

    public function test_closing_a_period_snapshots_balances_and_inventory(): void
    {
        $customer = Customer::factory()->create(['opening_balance' => 200, 'opening_balance_type' => 'debit']);
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();
        $user = User::factory()->create();

        app(RecordStockMovementAction::class)
            ->execute($product, $warehouse, 'opening', 10, 5);

        $closing = app(ClosePeriodAction::class)->execute(
            periodType: PeriodClosing::TYPE_DAILY,
            periodStart: Carbon::parse('2026-01-01'),
            periodEnd: Carbon::parse('2026-01-01'),
            closedBy: $user->id,
        );

        $this->assertEquals(PeriodClosing::STATUS_CLOSED, $closing->status);

        $customerSnapshot = $closing->snapshots()
            ->where('snapshot_type', PeriodClosingSnapshot::TYPE_CUSTOMER_BALANCE)
            ->where('reference_id', $customer->id)
            ->first();
        $this->assertEquals(200.0, (float) $customerSnapshot->amount);

        $inventorySnapshot = $closing->snapshots()
            ->where('snapshot_type', PeriodClosingSnapshot::TYPE_INVENTORY_VALUE)
            ->where('reference_id', $product->id)
            ->first();
        $this->assertEquals(50.0, (float) $inventorySnapshot->amount); // 10 * 5
    }

    public function test_cannot_close_a_period_overlapping_an_already_closed_one(): void
    {
        $user = User::factory()->create();

        app(ClosePeriodAction::class)->execute(
            PeriodClosing::TYPE_DAILY,
            Carbon::parse('2026-01-01'),
            Carbon::parse('2026-01-01'),
            $user->id,
        );

        $this->expectException(InvalidPeriodClosingException::class);
        app(ClosePeriodAction::class)->execute(
            PeriodClosing::TYPE_DAILY,
            Carbon::parse('2026-01-01'),
            Carbon::parse('2026-01-01'),
            $user->id,
        );
    }

    public function test_creating_a_sale_dated_within_a_closed_period_is_rejected(): void
    {
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $user = User::factory()->create();

        app(RecordStockMovementAction::class)
            ->execute($product, $warehouse, 'opening', 10, 5);

        app(ClosePeriodAction::class)->execute(
            PeriodClosing::TYPE_DAILY,
            Carbon::parse('2026-01-01'),
            Carbon::parse('2026-01-01'),
            $user->id,
        );

        $this->expectException(PeriodClosedException::class);
        app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id, 'sale_date' => Carbon::parse('2026-01-01 10:00:00')],
            items: [['product_id' => $product->id, 'quantity' => 1, 'unit_id' => $product->unit_id, 'unit_price' => 10]],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 10]],
            cashierId: $user->id,
        );
    }

    /**
     * A closed period has to say what the shop *did*, not only what it was
     * left holding. Balances alone cannot answer "did we make money?".
     */
    public function test_closing_a_period_records_what_it_traded(): void
    {
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $category = ExpenseCategory::factory()->create(['name' => 'Rent']);
        $user = User::factory()->create();

        app(RecordStockMovementAction::class)
            ->execute($product, $warehouse, 'opening', 10, 4);

        app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id, 'sale_date' => Carbon::parse('2026-03-05 10:00:00')],
            items: [['product_id' => $product->id, 'quantity' => 2, 'unit_id' => $product->unit_id, 'unit_price' => 10]],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 20]],
            cashierId: $user->id,
        );

        app(CreateExpenseAction::class)->execute([
            'expense_category_id' => $category->id,
            'cash_account_id' => $cashAccount->id,
            'amount' => 6,
            'expense_date' => Carbon::parse('2026-03-06 09:00:00'),
        ], $user->id);

        $closing = app(ClosePeriodAction::class)->execute(
            periodType: PeriodClosing::TYPE_MONTHLY,
            periodStart: Carbon::parse('2026-03-01'),
            periodEnd: Carbon::parse('2026-03-31'),
            closedBy: $user->id,
        );

        $amountOf = fn (string $type) => (float) $closing->snapshots()
            ->where('snapshot_type', $type)->value('amount');

        // Sold 2 at 10 that cost 4 each; rent of 6 on top.
        $this->assertEqualsWithDelta(20.0, $amountOf(PeriodClosingSnapshot::TYPE_REVENUE), 0.01);
        $this->assertEqualsWithDelta(8.0, $amountOf(PeriodClosingSnapshot::TYPE_COGS), 0.01);
        $this->assertEqualsWithDelta(12.0, $amountOf(PeriodClosingSnapshot::TYPE_GROSS_PROFIT), 0.01);
        $this->assertEqualsWithDelta(6.0, $amountOf(PeriodClosingSnapshot::TYPE_NET_PROFIT), 0.01);

        // Expenses are kept per category, so the biggest cost stays visible.
        $rent = $closing->snapshots()
            ->where('snapshot_type', PeriodClosingSnapshot::TYPE_OPERATING_EXPENSE)
            ->where('reference_label', 'Rent')
            ->first();
        $this->assertNotNull($rent);
        $this->assertEqualsWithDelta(6.0, (float) $rent->amount, 0.01);
    }

    /**
     * Trading outside the period is somebody else's month, and a closing
     * that swept it in would overstate every figure on the page.
     */
    public function test_trading_outside_the_period_is_left_out_of_it(): void
    {
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $user = User::factory()->create();

        app(RecordStockMovementAction::class)
            ->execute($product, $warehouse, 'opening', 10, 4);

        // A month after the period being closed.
        app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id, 'sale_date' => Carbon::parse('2026-04-05 10:00:00')],
            items: [['product_id' => $product->id, 'quantity' => 2, 'unit_id' => $product->unit_id, 'unit_price' => 10]],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 20]],
            cashierId: $user->id,
        );

        $closing = app(ClosePeriodAction::class)->execute(
            periodType: PeriodClosing::TYPE_MONTHLY,
            periodStart: Carbon::parse('2026-03-01'),
            periodEnd: Carbon::parse('2026-03-31'),
            closedBy: $user->id,
        );

        $revenue = (float) $closing->snapshots()
            ->where('snapshot_type', PeriodClosingSnapshot::TYPE_REVENUE)->value('amount');

        $this->assertEqualsWithDelta(0.0, $revenue, 0.01);
    }

    public function test_creating_a_sale_after_the_closed_period_still_works(): void
    {
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $user = User::factory()->create();

        app(RecordStockMovementAction::class)
            ->execute($product, $warehouse, 'opening', 10, 5);

        app(ClosePeriodAction::class)->execute(
            PeriodClosing::TYPE_DAILY,
            Carbon::parse('2026-01-01'),
            Carbon::parse('2026-01-01'),
            $user->id,
        );

        $sale = app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id, 'sale_date' => Carbon::parse('2026-01-02 10:00:00')],
            items: [['product_id' => $product->id, 'quantity' => 1, 'unit_id' => $product->unit_id, 'unit_price' => 10]],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 10]],
            cashierId: $user->id,
        );

        $this->assertNotNull($sale->id);
    }

    public function test_expense_dated_within_closed_period_is_rejected(): void
    {
        $category = ExpenseCategory::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $user = User::factory()->create();

        app(ClosePeriodAction::class)->execute(
            PeriodClosing::TYPE_DAILY,
            Carbon::parse('2026-01-01'),
            Carbon::parse('2026-01-01'),
            $user->id,
        );

        $this->expectException(PeriodClosedException::class);
        app(CreateExpenseAction::class)->execute([
            'expense_category_id' => $category->id,
            'cash_account_id' => $cashAccount->id,
            'amount' => 50,
            'expense_date' => Carbon::parse('2026-01-01 08:00:00'),
        ], $user->id);
    }

    public function test_only_the_most_recently_closed_period_can_be_reopened(): void
    {
        $user = User::factory()->create();

        $first = app(ClosePeriodAction::class)->execute(
            PeriodClosing::TYPE_DAILY, Carbon::parse('2026-01-01'), Carbon::parse('2026-01-01'), $user->id,
        );
        app(ClosePeriodAction::class)->execute(
            PeriodClosing::TYPE_DAILY, Carbon::parse('2026-01-02'), Carbon::parse('2026-01-02'), $user->id,
        );

        $this->expectException(InvalidPeriodClosingException::class);
        app(ReopenPeriodAction::class)->execute($first);
    }

    public function test_reopening_the_latest_closed_period_succeeds(): void
    {
        $user = User::factory()->create();

        $closing = app(ClosePeriodAction::class)->execute(
            PeriodClosing::TYPE_DAILY, Carbon::parse('2026-01-01'), Carbon::parse('2026-01-01'), $user->id,
        );

        $reopened = app(ReopenPeriodAction::class)->execute($closing);
        $this->assertEquals(PeriodClosing::STATUS_REOPENED, $reopened->status);
    }

    public function test_period_closing_detail_exposes_activity_log_for_close_and_reopen(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create(['name' => 'Manager Mona']);
        $this->grantRole($manager, 'manager');
        $admin = User::factory()->create(['name' => 'Admin Ali']);
        $admin->assignRole('admin');

        $closeResponse = $this->actingAs($manager)->postJson('/api/v1/period-closings', [
            'period_type' => 'daily',
            'period_start' => '2026-01-01',
            'period_end' => '2026-01-01',
        ])->assertCreated();
        $id = $closeResponse->json('data.id');

        $this->actingAs($admin)->postJson("/api/v1/period-closings/{$id}/reopen")->assertOk();

        $response = $this->actingAs($admin)->getJson("/api/v1/period-closings/{$id}")->assertOk();
        $activities = collect($response->json('data.activities'));

        $this->assertTrue($activities->contains(fn ($a) => $a['description'] === 'period_closed' && $a['causer_name'] === 'Manager Mona'));
        $this->assertTrue($activities->contains(fn ($a) => $a['description'] === 'period_reopened' && $a['causer_name'] === 'Admin Ali'));
    }

    public function test_manager_can_close_period_but_only_admin_can_reopen(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $this->grantRole($manager, 'manager');
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $closeResponse = $this->actingAs($manager)->postJson('/api/v1/period-closings', [
            'period_type' => 'daily',
            'period_start' => '2026-01-01',
            'period_end' => '2026-01-01',
        ]);
        $closeResponse->assertCreated();
        $id = $closeResponse->json('data.id');

        $this->actingAs($manager)
            ->postJson("/api/v1/period-closings/{$id}/reopen")
            ->assertForbidden();

        $this->actingAs($admin)
            ->postJson("/api/v1/period-closings/{$id}/reopen")
            ->assertOk()
            ->assertJsonPath('data.status', 'reopened');
    }
}
