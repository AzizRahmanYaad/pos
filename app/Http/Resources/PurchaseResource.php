<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PurchaseResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'purchase_number' => $this->purchase_number,
            'supplier_id' => $this->supplier_id,
            'supplier_name' => $this->whenLoaded('supplier', fn () => $this->supplier->name),
            'warehouse_id' => $this->warehouse_id,
            'warehouse_name' => $this->whenLoaded('warehouse', fn () => $this->warehouse->name),
            'status' => $this->status,
            'purchase_date' => $this->purchase_date,
            'subtotal' => (float) $this->subtotal,
            'discount' => (float) $this->discount,
            'tax' => (float) $this->tax,
            'landed_cost_total' => (float) $this->landed_cost_total,
            'grand_total' => (float) $this->grand_total,
            'paid_amount' => (float) $this->paid_amount,
            'due_amount' => (float) $this->due_amount,
            'items' => PurchaseItemResource::collection($this->whenLoaded('items')),
            'landed_costs' => PurchaseLandedCostResource::collection($this->whenLoaded('landedCosts')),
            'created_at' => $this->created_at,
        ];
    }
}
