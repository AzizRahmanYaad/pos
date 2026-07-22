<?php

namespace App\Http\Resources;

use App\Models\Purchase;
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
            'items' => $this->itemsWithCostPreview(),
            'landed_costs' => PurchaseLandedCostResource::collection($this->whenLoaded('landedCosts')),
            'created_at' => $this->created_at,
        ];
    }

    /**
     * The purchase's items, each carrying its landed cost / total cost.
     * Once received these are the real, persisted allocation; on a
     * still-draft purchase (nothing allocated yet) they're instead a live
     * estimate of what each item would get, computed from the same
     * proportional-by-value formula the receive step uses — so the figures
     * are never a misleading stale 0 just because the purchase hasn't been
     * received yet.
     */
    private function itemsWithCostPreview(): array
    {
        if (! $this->relationLoaded('items')) {
            return [];
        }

        $items = $this->items;
        $landedTotal = $this->relationLoaded('landedCosts')
            ? (float) $this->landedCosts->sum('amount')
            : (float) $this->landed_cost_total;

        $showPreview = $this->status === Purchase::STATUS_DRAFT && $landedTotal > 0 && $items->isNotEmpty();
        $previewAllocations = $showPreview ? Purchase::allocateLandedCost($items, $landedTotal) : [];

        return $items->map(function ($item) use ($previewAllocations) {
            $resource = (new PurchaseItemResource($item))->resolve();

            if (isset($previewAllocations[$item->id]) && (float) $item->allocated_landed_cost <= 0) {
                $quantity = (float) $item->quantity;
                $preview = $previewAllocations[$item->id];
                $previewUnitCost = $quantity > 0 ? (float) $item->unit_cost + ($preview / $quantity) : (float) $item->unit_cost;

                $resource['allocated_landed_cost'] = round($preview, 2);
                $resource['landed_unit_cost'] = round($previewUnitCost, 4);
                $resource['total_cost'] = round($quantity * $previewUnitCost, 2);
                $resource['landed_cost_is_estimated'] = true;
            }

            return $resource;
        })->values()->all();
    }
}
