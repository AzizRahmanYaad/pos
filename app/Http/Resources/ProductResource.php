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
            'default_cost' => (float) $this->default_cost,
            'tax_rate' => (float) $this->tax_rate,
            'reorder_level' => (float) $this->reorder_level,
            'track_inventory' => $this->track_inventory,
            'attributes' => $this->attributes,
            'is_active' => $this->is_active,
            'stocks' => ProductStockResource::collection($this->whenLoaded('stocks')),
            'total_stock' => $this->when($this->relationLoaded('stocks'), fn () => (float) $this->stocks->sum('quantity')),
        ];
    }
}
