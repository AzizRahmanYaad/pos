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

    /*
     * What the period earned, as against what was left standing at the end
     * of it. The balances above are a position; these are the trading that
     * produced it, and without them a closed period could say what the shop
     * was worth but never what it had done.
     */
    public const TYPE_REVENUE = 'revenue';

    public const TYPE_DISCOUNTS = 'discounts';

    public const TYPE_COGS = 'cogs';

    public const TYPE_GROSS_PROFIT = 'gross_profit';

    /** One row per category, so the biggest cost is visible, not just the sum. */
    public const TYPE_OPERATING_EXPENSE = 'operating_expense';

    public const TYPE_PAYROLL_COST = 'payroll_cost';

    public const TYPE_NET_PROFIT = 'net_profit';

    public const TYPE_PURCHASES = 'purchases';

    /** The figures that describe the period rather than list its parties. */
    public const RESULT_TYPES = [
        self::TYPE_REVENUE,
        self::TYPE_DISCOUNTS,
        self::TYPE_COGS,
        self::TYPE_GROSS_PROFIT,
        self::TYPE_OPERATING_EXPENSE,
        self::TYPE_PAYROLL_COST,
        self::TYPE_NET_PROFIT,
        self::TYPE_PURCHASES,
    ];

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
