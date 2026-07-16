<?php

namespace Tests\Feature\Ledger;

use App\Domain\Ledger\Actions\PostLedgerEntryAction;
use App\Models\Customer;
use App\Models\LedgerEntry;
use App\Models\Supplier;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LedgerTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_with_opening_balance_gets_a_ledger_entry_on_creation(): void
    {
        $customer = Customer::factory()->create([
            'opening_balance' => 500,
            'opening_balance_type' => LedgerEntry::DEBIT,
        ]);

        $this->assertEquals(500.0, $customer->currentBalance());
        $this->assertDatabaseHas('ledger_entries', [
            'ledgerable_type' => $customer->getMorphClass(),
            'ledgerable_id' => $customer->id,
            'entry_type' => LedgerEntry::DEBIT,
            'amount' => 500,
        ]);
    }

    public function test_supplier_with_zero_opening_balance_gets_no_ledger_entry(): void
    {
        $supplier = Supplier::factory()->create(['opening_balance' => 0]);

        $this->assertEquals(0.0, $supplier->currentBalance());
        $this->assertDatabaseCount('ledger_entries', 0);
    }

    public function test_debit_then_credit_entries_produce_correct_running_balance(): void
    {
        $customer = Customer::factory()->create(['opening_balance' => 0]);
        $action = app(PostLedgerEntryAction::class);

        $action->execute($customer, LedgerEntry::DEBIT, 300, description: 'Sale on credit');
        $second = $action->execute($customer, LedgerEntry::CREDIT, 120, description: 'Payment received');

        $this->assertEquals(180.0, (float) $second->running_balance);
        $this->assertEquals(180.0, $customer->currentBalance());
    }

    public function test_supplier_ledger_purchase_then_payment_running_balance(): void
    {
        $supplier = Supplier::factory()->create(['opening_balance' => 0]);
        $action = app(PostLedgerEntryAction::class);

        // Purchase on credit increases what we owe the supplier (credit).
        $action->execute($supplier, LedgerEntry::CREDIT, 1000, description: 'Purchase invoice');
        // Payment made reduces what we owe (debit).
        $last = $action->execute($supplier, LedgerEntry::DEBIT, 400, description: 'Payment made');

        $this->assertEquals(-600.0, (float) $last->running_balance);
    }

    public function test_customer_ledger_statement_endpoint_returns_entries_and_balance(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $user = User::factory()->create();
        $user->assignRole('cashier');

        $customer = Customer::factory()->create(['opening_balance' => 250, 'opening_balance_type' => LedgerEntry::DEBIT]);

        $response = $this->actingAs($user)->getJson("/api/v1/customers/{$customer->id}/ledger");

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('current_balance', 250);
    }

    public function test_user_without_sales_permission_cannot_create_customer(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        // A user with no role assigned has no permissions at all.
        $unassigned = User::factory()->create();

        $this->actingAs($unassigned)->postJson('/api/v1/customers', [
            'name' => 'Walk-in',
        ])->assertForbidden();
    }

    public function test_cashier_can_create_customer(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $cashier = User::factory()->create();
        $cashier->assignRole('cashier');

        $this->actingAs($cashier)->postJson('/api/v1/customers', [
            'name' => 'Walk-in',
        ])->assertCreated();
    }

    public function test_manager_can_create_customer(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $manager->assignRole('manager');

        $this->actingAs($manager)->postJson('/api/v1/customers', [
            'name' => 'Regular Customer',
            'opening_balance' => 100,
            'opening_balance_type' => LedgerEntry::DEBIT,
        ])->assertCreated()->assertJsonPath('data.current_balance', 100);
    }
}
