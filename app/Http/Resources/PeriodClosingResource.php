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
            // What the period traded, either as recorded when it was closed
            // or, for periods closed before those figures were kept, worked
            // out now from the same records the profit-and-loss report reads.
            // The payload says which, so a figure derived today is never
            // mistaken for one agreed when the books shut.
            'trading_figures' => $this->trading_figures,
            'snapshots' => PeriodClosingSnapshotResource::collection($this->whenLoaded('snapshots')),
            'activities' => ActivityLogResource::collection($this->whenLoaded('activities')),
        ];
    }
}
