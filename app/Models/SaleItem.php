<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'sale_id', 'product_id', 'quantity', 'refunded_quantity', 'unit_id', 'unit_price',
    'cost_price_snapshot', 'discount', 'tax', 'line_total',
])]
class SaleItem extends Model
{
    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'refunded_quantity' => 'decimal:4',
            'unit_price' => 'decimal:4',
            'cost_price_snapshot' => 'decimal:4',
            'discount' => 'decimal:2',
            'tax' => 'decimal:2',
            'line_total' => 'decimal:2',
        ];
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
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
