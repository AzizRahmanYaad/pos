<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PayrollItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'employee_id' => $this->employee_id,
            'employee_name' => $this->whenLoaded('employee', fn () => $this->employee->name),
            'base_salary' => (float) $this->base_salary,
            'advances_deducted' => (float) $this->advances_deducted,
            'other_deductions' => (float) $this->other_deductions,
            'bonuses' => (float) $this->bonuses,
            'net_pay' => (float) $this->net_pay,
        ];
    }
}
