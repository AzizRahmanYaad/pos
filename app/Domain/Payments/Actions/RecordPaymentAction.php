<?php

namespace App\Domain\Payments\Actions;

use App\Domain\Ledger\Actions\PostLedgerEntryAction;
use App\Domain\PeriodClosing\Services\PeriodGuard;
use App\Models\CashAccount;
use App\Models\LedgerEntry;
use App\Models\Payment;
use App\Models\Purchase;
use App\Models\Sale;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class RecordPaymentAction
{
    public function __construct(
        private readonly PostLedgerEntryAction $postLedgerEntry,
        private readonly PeriodGuard $periodGuard,
    ) {}

    /**
     * Record a standalone payment (a customer paying down their balance, or
     * the business paying a supplier) and post the matching ledger entries.
     * Direction alone decides entry types, independent of party type:
     * 'in' credits the party / debits the cash account, 'out' does the
     * reverse — which stays correct whether the party is a customer or a
     * supplier, since running_balance sign already encodes who owes whom.
     */
    public function execute(
        Model $party,
        string $direction,
        float $amount,
        CashAccount $cashAccount,
        string $method,
        ?string $description,
        ?Model $reference,
        int $receivedBy,
        ?Carbon $paidAt = null,
    ): Payment {
        $this->periodGuard->assertMutable($paidAt ?? now());

        return DB::transaction(function () use (
            $party, $direction, $amount, $cashAccount, $method, $description, $reference, $receivedBy, $paidAt,
        ) {
            $payment = Payment::create([
                'party_type' => $party->getMorphClass(),
                'party_id' => $party->getKey(),
                'direction' => $direction,
                'amount' => $amount,
                'cash_account_id' => $cashAccount->id,
                'method' => $method,
                'reference_type' => $reference?->getMorphClass(),
                'reference_id' => $reference?->getKey(),
                'description' => $description,
                'paid_at' => $paidAt ?? now(),
                'received_by' => $receivedBy,
            ]);

            $partyEntryType = $direction === Payment::DIRECTION_IN ? LedgerEntry::CREDIT : LedgerEntry::DEBIT;
            $cashEntryType = $direction === Payment::DIRECTION_IN ? LedgerEntry::DEBIT : LedgerEntry::CREDIT;
            $label = $description ?: 'Payment';

            $this->postLedgerEntry->execute(
                ledgerable: $party,
                entryType: $partyEntryType,
                amount: $amount,
                source: $payment,
                description: $label,
                transactionDate: $payment->paid_at,
                createdBy: $receivedBy,
            );

            $this->postLedgerEntry->execute(
                ledgerable: $cashAccount,
                entryType: $cashEntryType,
                amount: $amount,
                source: $payment,
                description: $label,
                transactionDate: $payment->paid_at,
                createdBy: $receivedBy,
            );

            if ($reference instanceof Purchase || $reference instanceof Sale) {
                $newPaid = round((float) $reference->paid_amount + $amount, 2);
                $reference->update([
                    'paid_amount' => $newPaid,
                    'due_amount' => max(0, round((float) $reference->grand_total - $newPaid, 2)),
                ]);
            }

            return $payment;
        });
    }
}
