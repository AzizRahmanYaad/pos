<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphMany;

#[Fillable(['name', 'type', 'opening_balance', 'is_active'])]
class CashAccount extends Model
{
    use BelongsToTenant;

    use HasFactory;

    public const TYPE_CASH = 'cash';

    public const TYPE_BANK = 'bank';

    public const TYPE_MOBILE_WALLET = 'mobile_wallet';

    protected function casts(): array
    {
        return [
            'opening_balance' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function ledgerEntries(): MorphMany
    {
        return $this->morphMany(LedgerEntry::class, 'ledgerable');
    }

    public function currentBalance(): float
    {
        return (float) ($this->ledgerEntries()->latest('transaction_date')->latest('id')->value('running_balance') ?? 0);
    }
}
