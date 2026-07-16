<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'payroll_run_id', 'employee_id', 'base_salary', 'advances_deducted',
    'other_deductions', 'bonuses', 'net_pay',
])]
class PayrollItem extends Model
{
    protected function casts(): array
    {
        return [
            'base_salary' => 'decimal:2',
            'advances_deducted' => 'decimal:2',
            'other_deductions' => 'decimal:2',
            'bonuses' => 'decimal:2',
            'net_pay' => 'decimal:2',
        ];
    }

    public function payrollRun(): BelongsTo
    {
        return $this->belongsTo(PayrollRun::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function deductedAdvances(): HasMany
    {
        return $this->hasMany(EmployeeAdvance::class, 'deducted_in_payroll_item_id');
    }
}
