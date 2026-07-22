<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PurchaseItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $quantity = (float) $this->quantity;
        $allocatedLandedCost = (float) $this->allocated_landed_cost;
        // The unit cost actually capitalized into inventory (unit_cost plus
        // this line's share of the purchase's landed costs) and the total
        // cost of goods for the line at that rate — set once the purchase
        // is received; both are 0/unit_cost on a still-draft purchase.
        $landedUnitCost = $quantity > 0 ? (float) $this->unit_cost + ($allocatedLandedCost / $quantity) : (float) $this->unit_cost;

        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'product_name' => $this->whenLoaded('product', fn () => $this->product->name),
            'quantity' => $quantity,
            'unit_cost' => (float) $this->unit_cost,
            'discount' => (float) $this->discount,
            'tax' => (float) $this->tax,
            'line_total' => (float) $this->line_total,
            'received_quantity' => (float) $this->received_quantity,
            'allocated_landed_cost' => round($allocatedLandedCost, 2),
            'landed_unit_cost' => round($landedUnitCost, 4),
            'total_cost' => round($quantity * $landedUnitCost, 2),
        ];
    }
}
