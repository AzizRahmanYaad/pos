<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'period_closing_id', 'snapshot_type', 'reference_id', 'reference_label',
    'amount', 'quantity', 'metadata',
])]
class PeriodClosingSnapshot extends Model
{
    public const TYPE_CUSTOMER_BALANCE = 'customer_balance';

    public const TYPE_SUPPLIER_BALANCE = 'supplier_balance';

    public const TYPE_EMPLOYEE_BALANCE = 'employee_balance';

    public const TYPE_CASH_BALANCE = 'cash_balance';

    public const TYPE_INVENTORY_VALUE = 'inventory_value';

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'quantity' => 'decimal:4',
            'metadata' => 'array',
        ];
    }

    public function periodClosing(): BelongsTo
    {
        return $this->belongsTo(PeriodClosing::class);
    }
}
