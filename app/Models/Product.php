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
    'sale_price', 'pricing_mode', 'margin_percent', 'margin_basis', 'default_cost', 'tax_rate', 'reorder_level',
    'track_inventory', 'attributes', 'is_active',
])]
class Product extends Model
{
    use BelongsToTenant;

    use HasFactory;

    public const TYPE_STANDARD = 'standard';

    public const TYPE_SERVICE = 'service';

    public const TYPE_RAW_MATERIAL = 'raw_material';

    public const PRICING_FIXED = 'fixed';

    public const PRICING_MARGIN = 'margin';

    /** Margin % is a markup added on top of cost: price = cost * (1 + %/100). */
    public const MARGIN_BASIS_MARKUP = 'markup';

    /** Margin % is the target profit as a share of the selling price itself: price = cost / (1 - %/100). */
    public const MARGIN_BASIS_PROFIT = 'profit';

    protected function casts(): array
    {
        return [
            'sale_price' => 'decimal:2',
            'margin_percent' => 'decimal:2',
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

    /**
     * The blended cost of everything currently on hand across all
     * warehouses — always read fresh from the database, since this is the
     * basis automatic margin pricing recalculates from right after a
     * purchase updates stock.
     */
    public function overallAverageCost(): float
    {
        $stocks = $this->stocks()->get();
        $totalQuantity = (float) $stocks->sum('quantity');

        if ($totalQuantity <= 0) {
            return (float) $this->default_cost;
        }

        $totalValue = (float) $stocks->sum(fn (ProductStock $stock) => (float) $stock->quantity * (float) $stock->average_cost);

        return round($totalValue / $totalQuantity, 4);
    }

    /**
     * The sale price implied by this product's margin settings for a given
     * cost. Markup basis adds the percentage on top of cost (traditional
     * "cost-plus" pricing); profit basis instead treats the percentage as
     * the share of the final selling price that should be profit (what
     * shops usually mean by "I want X% profit"), which requires dividing
     * rather than multiplying. Returns null when the settings can't produce
     * a sensible price (no margin set, or a profit share of 100% or more).
     */
    public function computeAutoPrice(float $cost): ?float
    {
        if ($this->margin_percent === null) {
            return null;
        }

        $percent = (float) $this->margin_percent;

        if ($this->margin_basis === self::MARGIN_BASIS_PROFIT) {
            if ($percent >= 100) {
                return null;
            }

            return round($cost / (1 - $percent / 100), 2);
        }

        return round($cost * (1 + $percent / 100), 2);
    }
}
