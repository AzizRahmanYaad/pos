<?php

namespace App\Observers;

use App\Domain\Ledger\Actions\PostLedgerEntryAction;
use App\Models\LedgerEntry;
use App\Models\Supplier;

class SupplierObserver
{
    public function created(Supplier $supplier): void
    {
        if ((float) $supplier->opening_balance === 0.0) {
            return;
        }

        app(PostLedgerEntryAction::class)->execute(
            ledgerable: $supplier,
            entryType: $supplier->opening_balance_type === LedgerEntry::DEBIT ? LedgerEntry::DEBIT : LedgerEntry::CREDIT,
            amount: (float) $supplier->opening_balance,
            description: 'Opening balance',
            transactionDate: $supplier->created_at,
        );
    }
}
