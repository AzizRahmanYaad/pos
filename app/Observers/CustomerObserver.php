<?php

namespace App\Observers;

use App\Domain\Ledger\Actions\PostLedgerEntryAction;
use App\Models\Customer;
use App\Models\LedgerEntry;

class CustomerObserver
{
    public function created(Customer $customer): void
    {
        if ((float) $customer->opening_balance === 0.0) {
            return;
        }

        app(PostLedgerEntryAction::class)->execute(
            ledgerable: $customer,
            entryType: $customer->opening_balance_type === LedgerEntry::CREDIT ? LedgerEntry::CREDIT : LedgerEntry::DEBIT,
            amount: (float) $customer->opening_balance,
            description: 'Opening balance',
            transactionDate: $customer->created_at,
        );
    }
}
