<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'sku' => $this->sku,
            'barcode' => $this->barcode,
            'name' => $this->name,
            'category_id' => $this->category_id,
            'category_name' => $this->whenLoaded('category', fn () => $this->category?->name),
            'unit_id' => $this->unit_id,
            'unit_short_name' => $this->whenLoaded('unit', fn () => $this->unit?->short_name),
            'type' => $this->type,
            'sale_price' => (float) $this->sale_price,
            'pricing_mode' => $this->pricing_mode,
            'margin_percent' => $this->margin_percent !== null ? (float) $this->margin_percent : null,
            'default_cost' => (float) $this->default_cost,
            'tax_rate' => (float) $this->tax_rate,
            'reorder_level' => (float) $this->reorder_level,
            'track_inventory' => $this->track_inventory,
            'attributes' => $this->attributes,
            'is_active' => $this->is_active,
            'stocks' => ProductStockResource::collection($this->whenLoaded('stocks')),
            'total_stock' => $this->when($this->relationLoaded('stocks'), fn () => (float) $this->stocks->sum('quantity')),
            'average_cost' => $this->when($this->relationLoaded('stocks'), function () {
                $totalQuantity = (float) $this->stocks->sum('quantity');

                if ($totalQuantity <= 0) {
                    return (float) $this->default_cost;
                }

                $totalValue = (float) $this->stocks->sum(fn ($stock) => (float) $stock->quantity * (float) $stock->average_cost);

                return round($totalValue / $totalQuantity, 4);
            }),
        ];
    }
}
