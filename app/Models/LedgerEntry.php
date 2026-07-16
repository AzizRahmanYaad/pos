<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

#[Fillable([
    'ledgerable_type', 'ledgerable_id', 'entry_type', 'amount', 'running_balance',
    'description', 'transaction_date', 'closed_period_id', 'created_by',
])]
class LedgerEntry extends Model
{
    public const DEBIT = 'debit';

    public const CREDIT = 'credit';

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'running_balance' => 'decimal:2',
            'transaction_date' => 'datetime',
        ];
    }

    public function ledgerable(): MorphTo
    {
        return $this->morphTo();
    }

    public function source(): MorphTo
    {
        return $this->morphTo();
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
