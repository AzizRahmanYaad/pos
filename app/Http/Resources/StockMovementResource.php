<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StockMovementResource extends JsonResource
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
            'warehouse_id' => $this->warehouse_id,
            'warehouse_name' => $this->whenLoaded('warehouse', fn () => $this->warehouse->name),
            'type' => $this->type,
            'quantity' => (float) $this->quantity,
            'unit_cost' => $this->unit_cost !== null ? (float) $this->unit_cost : null,
            'balance_after' => (float) $this->balance_after,
            'notes' => $this->notes,
            'movement_date' => $this->movement_date,
            'created_by' => $this->whenLoaded('creator', fn () => $this->creator?->name),
        ];
    }
}
