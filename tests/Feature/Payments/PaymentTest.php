<?php

namespace Tests\Feature\Payments;

use App\Domain\Ledger\Actions\PostLedgerEntryAction;
use App\Domain\Payments\Actions\RecordPaymentAction;
use App\Domain\Purchases\Actions\CreatePurchaseAction;
use App\Domain\Purchases\Actions\ReceivePurchaseAction;
use App\Models\CashAccount;
use App\Models\Customer;
use App\Models\LedgerEntry;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\BusinessSettingsSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(BusinessSettingsSeeder::class);
    }

    public function test_customer_payment_reduces_receivable_and_increases_cash(): void
    {
        $customer = Customer::factory()->create(['opening_balance' => 200, 'opening_balance_type' => LedgerEntry::DEBIT]);
        $cashAccount = CashAccount::factory()->create();
        $user = User::factory()->create();

        app(RecordPaymentAction::class)->execute(
            party: $customer,
            direction: Payment::DIRECTION_IN,
            amount: 80,
            cashAccount: $cashAccount,
            method: 'cash',
            description: 'Partial settlement',
            reference: null,
            receivedBy: $user->id,
        );

        $this->assertEquals(120.0, $customer->fresh()->currentBalance());
        $this->assertEquals(80.0, $cashAccount->fresh()->currentBalance());
    }

    public function test_supplier_payment_reduces_what_business_owes_and_decreases_cash(): void
    {
        $supplier = Supplier::factory()->create();
        $cashAccount = CashAccount::factory()->create(['opening_balance' => 500]);
        $user = User::factory()->create();

        app(PostLedgerEntryAction::class)->execute($supplier, LedgerEntry::CREDIT, 300, description: 'Purchase invoice');
        $this->assertEquals(-300.0, $supplier->fresh()->currentBalance());

        app(RecordPaymentAction::class)->execute(
            party: $supplier,
            direction: Payment::DIRECTION_OUT,
            amount: 300,
            cashAccount: $cashAccount,
            method: 'bank',
            description: 'Settle invoice',
            reference: null,
            receivedBy: $user->id,
        );

        $this->assertEquals(0.0, $supplier->fresh()->currentBalance());
        $this->assertEquals(200.0, $cashAccount->fresh()->currentBalance());
    }

    public function test_payment_against_a_purchase_updates_its_paid_and_due_amounts(): void
    {
        $supplier = Supplier::factory()->create();
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $user = User::factory()->create();

        $purchase = app(CreatePurchaseAction::class)->execute(
            data: ['supplier_id' => $supplier->id, 'warehouse_id' => $warehouse->id, 'purchase_date' => now()],
            items: [['product_id' => $product->id, 'quantity' => 10, 'unit_id' => $product->unit_id, 'unit_cost' => 10]],
            landedCosts: [],
            createdBy: $user->id,
        );
        app(ReceivePurchaseAction::class)->execute($purchase, $user->id);

        app(RecordPaymentAction::class)->execute(
            party: $supplier,
            direction: Payment::DIRECTION_OUT,
            amount: 60,
            cashAccount: $cashAccount,
            method: 'cash',
            description: null,
            reference: $purchase,
            receivedBy: $user->id,
        );

        $purchase->refresh();
        $this->assertEquals(60.0, (float) $purchase->paid_amount);
        $this->assertEquals(40.0, (float) $purchase->due_amount); // grand_total 100
    }

    public function test_manager_can_record_payment_via_api(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $manager->assignRole('manager');

        $customer = Customer::factory()->create(['opening_balance' => 100, 'opening_balance_type' => LedgerEntry::DEBIT]);
        $cashAccount = CashAccount::factory()->create();

        $response = $this->actingAs($manager)->postJson('/api/v1/payments', [
            'party_type' => 'customer',
            'party_id' => $customer->id,
            'direction' => 'in',
            'amount' => 50,
            'cash_account_id' => $cashAccount->id,
            'method' => 'cash',
        ]);

        $response->assertCreated()->assertJsonPath('data.amount', 50);
    }

    public function test_manager_can_pay_a_supplier_against_a_specific_purchase_via_api(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $manager->assignRole('manager');

        $supplier = Supplier::factory()->create();
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();
        $cashAccount = CashAccount::factory()->create();

        $purchase = app(CreatePurchaseAction::class)->execute(
            data: ['supplier_id' => $supplier->id, 'warehouse_id' => $warehouse->id, 'purchase_date' => now()],
            items: [['product_id' => $product->id, 'quantity' => 10, 'unit_id' => $product->unit_id, 'unit_cost' => 10]],
            landedCosts: [],
            createdBy: $manager->id,
        );
        app(ReceivePurchaseAction::class)->execute($purchase, $manager->id);

        $response = $this->actingAs($manager)->postJson('/api/v1/payments', [
            'party_type' => 'supplier',
            'party_id' => $supplier->id,
            'direction' => 'out',
            'amount' => 40,
            'cash_account_id' => $cashAccount->id,
            'method' => 'cash',
            'reference_type' => 'purchase',
            'reference_id' => $purchase->id,
        ]);

        $response->assertCreated();

        $purchase->refresh();
        $this->assertEquals(40.0, (float) $purchase->paid_amount);
        $this->assertEquals(60.0, (float) $purchase->due_amount);
        $this->assertEquals(-60.0, $supplier->fresh()->currentBalance());
    }

    public function test_cashier_cannot_record_standalone_payment(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $cashier = User::factory()->create();
        $cashier->assignRole('cashier');

        $customer = Customer::factory()->create();
        $cashAccount = CashAccount::factory()->create();

        $this->actingAs($cashier)->postJson('/api/v1/payments', [
            'party_type' => 'customer',
            'party_id' => $customer->id,
            'direction' => 'in',
            'amount' => 10,
            'cash_account_id' => $cashAccount->id,
            'method' => 'cash',
        ])->assertForbidden();
    }
}
