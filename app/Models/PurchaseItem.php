<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'purchase_id', 'product_id', 'quantity', 'unit_id', 'unit_cost',
    'discount', 'tax', 'line_total', 'received_quantity',
])]
class PurchaseItem extends Model
{
    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'unit_cost' => 'decimal:4',
            'discount' => 'decimal:2',
            'tax' => 'decimal:2',
            'line_total' => 'decimal:2',
            'received_quantity' => 'decimal:4',
        ];
    }

    public function purchase(): BelongsTo
    {
        return $this->belongsTo(Purchase::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }
}
