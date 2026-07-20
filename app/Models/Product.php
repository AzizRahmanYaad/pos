<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'sku', 'barcode', 'name', 'category_id', 'unit_id', 'type',
    'sale_price', 'default_cost', 'tax_rate', 'reorder_level',
    'track_inventory', 'attributes', 'is_active',
])]
class Product extends Model
{
    use BelongsToTenant;

    use HasFactory;

    public const TYPE_STANDARD = 'standard';

    public const TYPE_SERVICE = 'service';

    public const TYPE_RAW_MATERIAL = 'raw_material';

    protected function casts(): array
    {
        return [
            'sale_price' => 'decimal:2',
            'default_cost' => 'decimal:2',
            'tax_rate' => 'decimal:2',
            'reorder_level' => 'decimal:2',
            'track_inventory' => 'boolean',
            'attributes' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function stocks(): HasMany
    {
        return $this->hasMany(ProductStock::class);
    }

    public function totalStockQuantity(): string
    {
        return (string) $this->stocks->sum('quantity');
    }
}
