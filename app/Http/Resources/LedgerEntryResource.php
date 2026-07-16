<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LedgerEntryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'entry_type' => $this->entry_type,
            'amount' => (float) $this->amount,
            'running_balance' => (float) $this->running_balance,
            'description' => $this->description,
            'source_type' => $this->source_type,
            'transaction_date' => $this->transaction_date,
            'created_by' => $this->whenLoaded('creator', fn () => $this->creator?->name),
        ];
    }
}
