<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PaymentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'party_type' => class_basename($this->party_type),
            'party_id' => $this->party_id,
            'party_name' => $this->whenLoaded('party', fn () => $this->party?->name),
            'direction' => $this->direction,
            'amount' => (float) $this->amount,
            'cash_account_id' => $this->cash_account_id,
            'cash_account_name' => $this->whenLoaded('cashAccount', fn () => $this->cashAccount->name),
            'method' => $this->method,
            'reference_type' => $this->reference_type ? class_basename($this->reference_type) : null,
            'reference_id' => $this->reference_id,
            'description' => $this->description,
            'paid_at' => $this->paid_at,
            'received_by' => $this->whenLoaded('receiver', fn () => $this->receiver->name),
        ];
    }
}
