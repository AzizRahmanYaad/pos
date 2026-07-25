<?php

namespace App\Console\Commands;

use App\Models\LedgerEntry;
use Illuminate\Console\Command;

/**
 * Repairs running_balance for every ledger (cash account, customer,
 * supplier, employee) by recomputing it in true chronological order.
 *
 * Needed because an entry posted with a transaction_date earlier than
 * one already on the books — e.g. a supplier payment backdated to the
 * purchase's original date instead of the day it was actually paid —
 * still stores a running_balance computed as if it came last, while
 * every later-dated entry's own running_balance is left untouched. Since
 * the account's current balance is read from whichever entry has the
 * latest transaction_date, the backdated entry's effect goes missing
 * from the total even though the entry itself is right there in the
 * ledger. This walks every ledger in date order and rewrites the
 * running balance to what it should actually be at each step.
 */
class RebuildLedgerBalancesCommand extends Command
{
    protected $signature = 'ledger:rebuild-balances {--dry-run : Report what would change without saving}';

    protected $description = 'Recompute every ledger running_balance in chronological order, repairing any account thrown off by an out-of-order (e.g. backdated) entry.';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        $ledgerables = LedgerEntry::query()
            ->select('ledgerable_type', 'ledgerable_id')
            ->distinct()
            ->get();

        $fixedAccounts = 0;
        $fixedEntries = 0;

        foreach ($ledgerables as $ledgerable) {
            $entries = LedgerEntry::query()
                ->where('ledgerable_type', $ledgerable->ledgerable_type)
                ->where('ledgerable_id', $ledgerable->ledgerable_id)
                ->orderBy('transaction_date')
                ->orderBy('id')
                ->get();

            $balance = 0.0;
            $accountChanged = false;

            foreach ($entries as $entry) {
                $delta = $entry->entry_type === LedgerEntry::DEBIT ? (float) $entry->amount : -(float) $entry->amount;
                $balance = round($balance + $delta, 2);

                if (round((float) $entry->running_balance, 2) !== $balance) {
                    $fixedEntries++;
                    $accountChanged = true;

                    if (! $dryRun) {
                        $entry->running_balance = $balance;
                        $entry->save();
                    }
                }
            }

            if ($accountChanged) {
                $fixedAccounts++;
                $this->line("Fixed {$ledgerable->ledgerable_type} #{$ledgerable->ledgerable_id}");
            }
        }

        $this->info(($dryRun ? '[dry run] ' : '')."Rebuilt balances for {$fixedAccounts} account(s), {$fixedEntries} entry/entries corrected.");

        return self::SUCCESS;
    }
}
