<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PeriodClosingResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'period_type' => $this->period_type,
            'period_start' => $this->period_start,
            'period_end' => $this->period_end,
            'closed_at' => $this->closed_at,
            'closed_by' => $this->whenLoaded('closer', fn () => $this->closer?->name),
            'status' => $this->status,
            'notes' => $this->notes,
            'snapshots' => PeriodClosingSnapshotResource::collection($this->whenLoaded('snapshots')),
        ];
    }
}
