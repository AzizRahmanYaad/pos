<?php

namespace App\Domain\Ledger\Actions;

use App\Models\LedgerEntry;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class PostLedgerEntryAction
{
    /**
     * Post one ledger entry for a ledgerable party (Customer, Supplier, or
     * CashAccount) and recompute its running balance under a lock, so
     * concurrent postings against the same party can't race each other.
     *
     * Convention: a 'debit' entry increases running_balance, a 'credit'
     * entry decreases it. What debit/credit *mean* in business terms is
     * the caller's decision (e.g. a sale on credit debits the customer;
     * a purchase on credit credits the supplier) — this action only
     * maintains the running total.
     */
    public function execute(
        Model $ledgerable,
        string $entryType,
        float $amount,
        ?Model $source = null,
        ?string $description = null,
        ?Carbon $transactionDate = null,
        ?int $createdBy = null,
    ): LedgerEntry {
        return DB::transaction(function () use (
            $ledgerable, $entryType, $amount, $source, $description, $transactionDate, $createdBy,
        ) {
            $lastEntry = LedgerEntry::query()
                ->where('ledgerable_type', $ledgerable->getMorphClass())
                ->where('ledgerable_id', $ledgerable->getKey())
                ->lockForUpdate()
                ->orderByDesc('transaction_date')
                ->orderByDesc('id')
                ->first();

            $previousBalance = $lastEntry ? (float) $lastEntry->running_balance : 0.0;
            $delta = $entryType === LedgerEntry::DEBIT ? $amount : -$amount;
            $newBalance = round($previousBalance + $delta, 2);

            return LedgerEntry::create([
                'ledgerable_type' => $ledgerable->getMorphClass(),
                'ledgerable_id' => $ledgerable->getKey(),
                'entry_type' => $entryType,
                'amount' => $amount,
                'running_balance' => $newBalance,
                'source_type' => $source?->getMorphClass(),
                'source_id' => $source?->getKey(),
                'description' => $description,
                'transaction_date' => $transactionDate ?? now(),
                'created_by' => $createdBy,
            ]);
        });
    }
}
