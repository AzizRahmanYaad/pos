<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PayrollRunResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'period_month' => $this->period_month,
            'period_year' => $this->period_year,
            'status' => $this->status,
            'paid_at' => $this->paid_at,
            'items' => PayrollItemResource::collection($this->whenLoaded('items')),
            'total_net_pay' => $this->whenLoaded('items', fn () => (float) $this->items->sum('net_pay')),
        ];
    }
}
