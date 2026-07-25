<?php

namespace Tests\Feature\Ledger;

use App\Domain\Ledger\Actions\PostLedgerEntryAction;
use App\Models\CashAccount;
use App\Models\LedgerEntry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RebuildLedgerBalancesCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_repairs_a_balance_corrupted_by_an_out_of_order_entry(): void
    {
        $cashAccount = CashAccount::factory()->create(['opening_balance' => 0]);

        // Opened 10 days ago.
        LedgerEntry::create([
            'ledgerable_type' => $cashAccount->getMorphClass(),
            'ledgerable_id' => $cashAccount->id,
            'entry_type' => LedgerEntry::DEBIT,
            'amount' => 1000,
            'running_balance' => 1000,
            'description' => 'Opening balance',
            'transaction_date' => now()->subDays(10),
        ]);

        app(PostLedgerEntryAction::class)->execute(
            ledgerable: $cashAccount,
            entryType: LedgerEntry::DEBIT,
            amount: 200,
            description: "Today's sale",
        );

        // Simulate the exact corruption: a payment inserted with a
        // transaction_date earlier than the entry above already has (dated
        // 3 days ago — a purchase created a few days back, received and
        // paid today, but backdated to the purchase's original date).
        // Bypass the action to reproduce the raw corrupted state, the way
        // the pre-fix ReceivePurchaseAction used to create it.
        LedgerEntry::create([
            'ledgerable_type' => $cashAccount->getMorphClass(),
            'ledgerable_id' => $cashAccount->id,
            'entry_type' => LedgerEntry::CREDIT,
            'amount' => 100,
            'running_balance' => 1100, // computed against the latest entry at insert time
            'description' => 'Backdated supplier payment',
            'transaction_date' => now()->subDays(3),
        ]);

        // Corrupted: the account "shows" 1200 even though a 100 payment exists.
        $this->assertEquals(1200.0, $cashAccount->fresh()->currentBalance());

        $this->artisan('ledger:rebuild-balances')->assertSuccessful();

        $this->assertEquals(1100.0, $cashAccount->fresh()->currentBalance());

        // Every entry's running_balance now reflects true chronological order.
        $entries = $cashAccount->ledgerEntries()->orderBy('transaction_date')->orderBy('id')->get();
        $this->assertEquals(1000.0, (float) $entries[0]->running_balance); // opening balance
        $this->assertEquals(900.0, (float) $entries[1]->running_balance); // the backdated payment, now correctly second
        $this->assertEquals(1100.0, (float) $entries[2]->running_balance); // today's sale, now correctly last
    }

    public function test_dry_run_reports_without_saving(): void
    {
        $cashAccount = CashAccount::factory()->create(['opening_balance' => 500]);

        LedgerEntry::create([
            'ledgerable_type' => $cashAccount->getMorphClass(),
            'ledgerable_id' => $cashAccount->id,
            'entry_type' => LedgerEntry::CREDIT,
            'amount' => 50,
            'running_balance' => 999, // deliberately wrong
            'transaction_date' => now(),
        ]);

        $this->artisan('ledger:rebuild-balances --dry-run')->assertSuccessful();

        // Untouched — still the deliberately-wrong value.
        $this->assertEquals(999.0, $cashAccount->fresh()->currentBalance());
    }

    public function test_already_correct_balances_are_left_untouched(): void
    {
        $cashAccount = CashAccount::factory()->create(['opening_balance' => 300]);

        app(PostLedgerEntryAction::class)->execute(
            ledgerable: $cashAccount,
            entryType: LedgerEntry::CREDIT,
            amount: 50,
        );

        $this->assertEquals(250.0, $cashAccount->fresh()->currentBalance());

        $this->artisan('ledger:rebuild-balances')->assertSuccessful();

        $this->assertEquals(250.0, $cashAccount->fresh()->currentBalance());
    }
}
