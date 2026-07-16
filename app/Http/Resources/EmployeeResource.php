<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EmployeeResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'phone' => $this->phone,
            'id_number' => $this->id_number,
            'designation' => $this->designation,
            'salary_amount' => (float) $this->salary_amount,
            'salary_type' => $this->salary_type,
            'hire_date' => $this->hire_date,
            'is_active' => $this->is_active,
            'current_balance' => $this->currentBalance(),
            'outstanding_advances' => $this->outstandingAdvanceTotal(),
        ];
    }
}
