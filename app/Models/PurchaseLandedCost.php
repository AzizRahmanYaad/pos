<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['purchase_id', 'expense_id', 'description', 'amount', 'allocation_method'])]
class PurchaseLandedCost extends Model
{
    public const METHOD_BY_VALUE = 'by_value';

    public const METHOD_BY_QUANTITY = 'by_quantity';

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
        ];
    }

    public function purchase(): BelongsTo
    {
        return $this->belongsTo(Purchase::class);
    }
}
