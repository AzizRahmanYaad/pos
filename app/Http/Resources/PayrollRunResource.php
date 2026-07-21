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
            'employee_id' => $this->employee_id,
            'employee_name' => $this->whenLoaded('employee', fn () => $this->employee?->name),
            'period_month' => $this->period_month,
            'period_year' => $this->period_year,
            'period_date' => $this->period_date?->toDateString(),
            'status' => $this->status,
            'paid_at' => $this->paid_at,
            'items' => PayrollItemResource::collection($this->whenLoaded('items')),
            'total_net_pay' => $this->whenLoaded('items', fn () => (float) $this->items->sum('net_pay')),
        ];
    }
}
