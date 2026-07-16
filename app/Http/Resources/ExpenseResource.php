<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ExpenseResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'expense_category_id' => $this->expense_category_id,
            'category_name' => $this->whenLoaded('category', fn () => $this->category->name),
            'cash_account_id' => $this->cash_account_id,
            'cash_account_name' => $this->whenLoaded('cashAccount', fn () => $this->cashAccount->name),
            'amount' => (float) $this->amount,
            'expense_date' => $this->expense_date,
            'paid_to' => $this->paid_to,
            'description' => $this->description,
            'is_landed_cost' => $this->is_landed_cost,
            'purchase_id' => $this->purchase_id,
            'purchase_number' => $this->whenLoaded('purchase', fn () => $this->purchase?->purchase_number),
        ];
    }
}
