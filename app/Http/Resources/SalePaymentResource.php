<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SalePaymentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'cash_account_id' => $this->cash_account_id,
            'cash_account_name' => $this->whenLoaded('cashAccount', fn () => $this->cashAccount->name),
            'method' => $this->method,
            'amount' => (float) $this->amount,
        ];
    }
}
