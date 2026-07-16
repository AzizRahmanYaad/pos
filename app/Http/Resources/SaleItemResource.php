<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SaleItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'product_name' => $this->whenLoaded('product', fn () => $this->product->name),
            'quantity' => (float) $this->quantity,
            'unit_price' => (float) $this->unit_price,
            'cost_price_snapshot' => (float) $this->cost_price_snapshot,
            'discount' => (float) $this->discount,
            'tax' => (float) $this->tax,
            'line_total' => (float) $this->line_total,
        ];
    }
}
