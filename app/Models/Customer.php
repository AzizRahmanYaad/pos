<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphMany;

#[Fillable(['name', 'phone', 'address', 'opening_balance', 'opening_balance_type', 'credit_limit', 'is_active'])]
class Customer extends Model
{
    use BelongsToTenant;

    use HasFactory;

    protected function casts(): array
    {
        return [
            'opening_balance' => 'decimal:2',
            'credit_limit' => 'decimal:2',
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
