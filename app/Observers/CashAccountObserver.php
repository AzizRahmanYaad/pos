<?php

namespace App\Observers;

use App\Domain\Ledger\Actions\PostLedgerEntryAction;
use App\Models\CashAccount;
use App\Models\LedgerEntry;

class CashAccountObserver
{
    public function created(CashAccount $cashAccount): void
    {
        if ((float) $cashAccount->opening_balance === 0.0) {
            return;
        }

        app(PostLedgerEntryAction::class)->execute(
            ledgerable: $cashAccount,
            entryType: LedgerEntry::DEBIT,
            amount: (float) $cashAccount->opening_balance,
            description: 'Opening balance',
            transactionDate: $cashAccount->created_at,
        );
    }
}
