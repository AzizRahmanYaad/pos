<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PeriodClosingSnapshotResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'snapshot_type' => $this->snapshot_type,
            'reference_id' => $this->reference_id,
            'reference_label' => $this->reference_label,
            'amount' => (float) $this->amount,
            'quantity' => $this->quantity !== null ? (float) $this->quantity : null,
            'metadata' => $this->metadata,
        ];
    }
}
