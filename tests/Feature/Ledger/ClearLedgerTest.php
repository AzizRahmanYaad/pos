<?php

namespace Tests\Feature\Ledger;

use App\Domain\Ledger\Actions\PostLedgerEntryAction;
use App\Models\Customer;
use App\Models\LedgerEntry;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClearLedgerTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        return $admin;
    }

    private function postEntries(Customer $customer, float $debit, float $credit): void
    {
        $action = app(PostLedgerEntryAction::class);
        $action->execute($customer, LedgerEntry::DEBIT, $debit, description: 'Sale');
        if ($credit > 0) {
            $action->execute($customer, LedgerEntry::CREDIT, $credit, description: 'Payment');
        }
    }

    public function test_ledger_cannot_be_cleared_while_a_balance_remains(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $customer = Customer::create(['name' => 'Test Customer']);
        $this->postEntries($customer, 500, 300);

        $this->actingAs($this->admin())
            ->postJson("/api/v1/customers/{$customer->id}/ledger/clear")
            ->assertUnprocessable();
    }

    public function test_clearing_a_settled_ledger_archives_entries_and_logs_the_action(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $customer = Customer::create(['name' => 'Test Customer']);
        $this->postEntries($customer, 500, 500);

        $admin = $this->admin();

        $this->actingAs($admin)
            ->postJson("/api/v1/customers/{$customer->id}/ledger/clear")
            ->assertNoContent();

        // Default ledger view is empty; archived history is still there.
        $this->actingAs($admin)
            ->getJson("/api/v1/customers/{$customer->id}/ledger")
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->actingAs($admin)
            ->getJson("/api/v1/customers/{$customer->id}/ledger?include_archived=1")
            ->assertOk()
            ->assertJsonCount(2, 'data');

        // The clearing is written to the activity log.
        $this->assertDatabaseHas('activity_log', [
            'description' => 'Cleared customer ledger',
            'causer_id' => $admin->id,
        ]);

        // New entries after clearing start a fresh visible ledger.
        app(PostLedgerEntryAction::class)->execute($customer, LedgerEntry::DEBIT, 100, description: 'New sale');
        $this->actingAs($admin)
            ->getJson("/api/v1/customers/{$customer->id}/ledger")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.running_balance', 100);
    }

    public function test_ledger_pdf_statement_downloads_as_a_pdf(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $customer = Customer::create(['name' => 'Ahmad Wali', 'phone' => '0700111222']);
        $this->postEntries($customer, 500, 200);

        $response = $this->actingAs($this->admin())
            ->get("/api/v1/customers/{$customer->id}/ledger/pdf");

        $response->assertOk();
        $response->assertHeader('content-type', 'application/pdf');
        $this->assertStringStartsWith('%PDF-', $response->getContent());
    }

    public function test_ledger_supports_search_and_date_range_filters(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $customer = Customer::create(['name' => 'Test Customer']);
        $action = app(PostLedgerEntryAction::class);
        $action->execute($customer, LedgerEntry::DEBIT, 100, description: 'Sale INV-1', transactionDate: now()->subDays(10));
        $action->execute($customer, LedgerEntry::CREDIT, 40, description: 'Payment', transactionDate: now()->subDays(2));

        $admin = $this->admin();

        $this->actingAs($admin)
            ->getJson("/api/v1/customers/{$customer->id}/ledger?search=INV-1")
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $from = now()->subDays(5)->toDateString();
        $this->actingAs($admin)
            ->getJson("/api/v1/customers/{$customer->id}/ledger?from={$from}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.description', 'Payment');
    }
}
