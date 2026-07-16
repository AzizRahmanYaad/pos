<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['sale_id', 'cash_account_id', 'method', 'amount'])]
class SalePayment extends Model
{
    public const METHOD_CASH = 'cash';

    public const METHOD_CARD = 'card';

    public const METHOD_MOBILE_WALLET = 'mobile_wallet';

    public const METHOD_BANK = 'bank';

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
        ];
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function cashAccount(): BelongsTo
    {
        return $this->belongsTo(CashAccount::class);
    }
}
