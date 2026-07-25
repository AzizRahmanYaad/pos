<?php

namespace Tests\Feature\Parties;

use App\Domain\Ledger\Actions\PostLedgerEntryAction;
use App\Models\Customer;
use App\Models\LedgerEntry;
use App\Models\Supplier;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PartySummaryTest extends TestCase
{
    use RefreshDatabase;

    private function cashier(): User
    {
        $user = User::factory()->create();
        $this->grantRole($user, 'cashier');

        return $user;
    }

    public function test_customer_summary_splits_receivable_and_advance(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $action = app(PostLedgerEntryAction::class);

        // Owes us 300 (debit increases the customer's balance — they owe more).
        $owesUs = Customer::create(['name' => 'Owes Us']);
        $action->execute($owesUs, LedgerEntry::DEBIT, 300, description: 'Sale on credit');

        // We owe them 120 (credit decreases the balance below zero).
        $weOwe = Customer::create(['name' => 'We Owe']);
        $action->execute($weOwe, LedgerEntry::CREDIT, 120, description: 'Overpayment refund pending');

        $response = $this->actingAs($this->cashier())->getJson('/api/v1/customers/summary')->assertOk();

        $this->assertEquals(300.0, (float) $response->json('data.receivable'));
        $this->assertEquals(120.0, (float) $response->json('data.advance'));
    }

    public function test_supplier_summary_splits_payable_and_advance(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $action = app(PostLedgerEntryAction::class);

        // We owe them 500 (credit decreases the balance below zero).
        $weOwe = Supplier::create(['name' => 'We Owe Supplier']);
        $action->execute($weOwe, LedgerEntry::CREDIT, 800, description: 'Purchase on credit');
        $action->execute($weOwe, LedgerEntry::DEBIT, 300, description: 'Partial payment');

        // They owe us 200 (debit increases the balance above zero — a prepayment).
        $theyOwe = Supplier::create(['name' => 'Supplier Owes Us']);
        $action->execute($theyOwe, LedgerEntry::DEBIT, 200, description: 'Advance payment');

        // Suppliers are a buying-side module — a till user has no reason to
        // see what the shop owes, so this is a manager's view.
        $manager = User::factory()->create();
        $this->grantRole($manager, 'manager');

        $response = $this->actingAs($manager)->getJson('/api/v1/suppliers/summary')->assertOk();

        $this->assertEquals(500.0, (float) $response->json('data.payable'));
        $this->assertEquals(200.0, (float) $response->json('data.advance'));
    }
}
