<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

#[Fillable([
    'user_id', 'name', 'phone', 'id_number', 'designation',
    'salary_amount', 'salary_type', 'hire_date', 'is_active',
])]
class Employee extends Model
{
    use HasFactory;

    public const SALARY_MONTHLY = 'monthly';

    public const SALARY_DAILY = 'daily';

    protected function casts(): array
    {
        return [
            'salary_amount' => 'decimal:2',
            'hire_date' => 'date',
            'is_active' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function advances(): HasMany
    {
        return $this->hasMany(EmployeeAdvance::class);
    }

    public function payrollItems(): HasMany
    {
        return $this->hasMany(PayrollItem::class);
    }

    public function ledgerEntries(): MorphMany
    {
        return $this->morphMany(LedgerEntry::class, 'ledgerable');
    }

    public function currentBalance(): float
    {
        return (float) ($this->ledgerEntries()->latest('transaction_date')->latest('id')->value('running_balance') ?? 0);
    }

    public function outstandingAdvanceTotal(): float
    {
        return (float) $this->advances()->whereNull('deducted_in_payroll_item_id')->sum('amount');
    }
}
