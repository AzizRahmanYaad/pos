<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'employee_id', 'cash_account_id', 'amount', 'advance_date', 'reason',
    'deducted_in_payroll_item_id', 'closed_period_id', 'created_by',
])]
class EmployeeAdvance extends Model
{
    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'advance_date' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function cashAccount(): BelongsTo
    {
        return $this->belongsTo(CashAccount::class);
    }

    public function payrollItem(): BelongsTo
    {
        return $this->belongsTo(PayrollItem::class, 'deducted_in_payroll_item_id');
    }
}
