<?php

namespace App\Domain\PeriodClosing\Actions;

use App\Domain\PeriodClosing\Exceptions\InvalidPeriodClosingException;
use App\Domain\Reports\PeriodResults;
use App\Models\CashAccount;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\PeriodClosing;
use App\Models\PeriodClosingSnapshot;
use App\Models\ProductStock;
use App\Models\Supplier;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class ClosePeriodAction
{
    /**
     * Close an accounting period: snapshot every party's running balance
     * and the full inventory valuation as of now, then lock the period so
     * PeriodGuard rejects any future write dated within it. Periods must
     * close in order — a new period can't start before the latest closed
     * period ends, which keeps the locked timeline gap-free.
     */
    public function execute(
        string $periodType,
        Carbon $periodStart,
        Carbon $periodEnd,
        ?int $closedBy,
        ?string $notes = null,
    ): PeriodClosing {
        $latestClosedEnd = PeriodClosing::query()->where('status', PeriodClosing::STATUS_CLOSED)->max('period_end');

        if ($latestClosedEnd && $periodStart->lessThanOrEqualTo(Carbon::parse($latestClosedEnd))) {
            throw new InvalidPeriodClosingException(
                "Periods up to {$latestClosedEnd} are already closed. The next period must start after that."
            );
        }

        if ($periodEnd->lessThan($periodStart)) {
            throw new InvalidPeriodClosingException('period_end cannot be before period_start.');
        }

        return DB::transaction(function () use ($periodType, $periodStart, $periodEnd, $closedBy, $notes) {
            $closing = PeriodClosing::create([
                'period_type' => $periodType,
                'period_start' => $periodStart,
                'period_end' => $periodEnd,
                'closed_at' => now(),
                'closed_by' => $closedBy,
                'status' => PeriodClosing::STATUS_CLOSED,
                'notes' => $notes,
            ]);

            $this->snapshotLedgerable($closing, Customer::class, PeriodClosingSnapshot::TYPE_CUSTOMER_BALANCE);
            $this->snapshotLedgerable($closing, Supplier::class, PeriodClosingSnapshot::TYPE_SUPPLIER_BALANCE);
            $this->snapshotLedgerable($closing, Employee::class, PeriodClosingSnapshot::TYPE_EMPLOYEE_BALANCE);
            $this->snapshotLedgerable($closing, CashAccount::class, PeriodClosingSnapshot::TYPE_CASH_BALANCE);
            $this->snapshotInventory($closing);
            $this->snapshotResults($closing, $periodStart, $periodEnd);

            return $closing->load('snapshots');
        });
    }

    /**
     * @param  class-string<Model>  $modelClass
     */
    private function snapshotLedgerable(PeriodClosing $closing, string $modelClass, string $type): void
    {
        $modelClass::query()->each(function (Model $ledgerable) use ($closing, $type) {
            PeriodClosingSnapshot::create([
                'period_closing_id' => $closing->id,
                'snapshot_type' => $type,
                'reference_id' => $ledgerable->getKey(),
                'reference_label' => $ledgerable->name,
                'amount' => $ledgerable->currentBalance(),
            ]);
        });
    }

    /**
     * What the period traded, recorded at the moment it is closed.
     *
     * The balances say what the shop was worth when the books shut; these
     * say what it did to get there. Written down rather than computed on
     * demand because a closed period is a statement about a moment that has
     * passed — a later correction, a backdated expense, a reopened month
     * should not quietly rewrite what the closing said at the time.
     */
    private function snapshotResults(PeriodClosing $closing, Carbon $from, Carbon $to): void
    {
        $results = (new PeriodResults())->forRange($from->copy()->startOfDay(), $to->copy()->endOfDay());

        $figures = [
            PeriodClosingSnapshot::TYPE_REVENUE => $results['revenue'],
            PeriodClosingSnapshot::TYPE_DISCOUNTS => $results['discounts'],
            PeriodClosingSnapshot::TYPE_COGS => $results['cogs'],
            PeriodClosingSnapshot::TYPE_GROSS_PROFIT => $results['gross_profit'],
            PeriodClosingSnapshot::TYPE_PAYROLL_COST => $results['payroll_cost'],
            PeriodClosingSnapshot::TYPE_NET_PROFIT => $results['net_profit'],
            PeriodClosingSnapshot::TYPE_PURCHASES => $results['purchases_total'],
        ];

        foreach ($figures as $type => $amount) {
            PeriodClosingSnapshot::create([
                'period_closing_id' => $closing->id,
                'snapshot_type' => $type,
                'amount' => $amount,
                // The sale count rides with revenue: it is the only figure
                // here that is a tally rather than money.
                'quantity' => $type === PeriodClosingSnapshot::TYPE_REVENUE ? $results['sales_count'] : null,
            ]);
        }

        foreach ($results['operating_expenses_by_category'] as $row) {
            PeriodClosingSnapshot::create([
                'period_closing_id' => $closing->id,
                'snapshot_type' => PeriodClosingSnapshot::TYPE_OPERATING_EXPENSE,
                'reference_label' => $row['category'],
                'amount' => $row['total'],
            ]);
        }
    }

    private function snapshotInventory(PeriodClosing $closing): void
    {
        ProductStock::query()->with('product')->get()->each(function (ProductStock $stock) use ($closing) {
            PeriodClosingSnapshot::create([
                'period_closing_id' => $closing->id,
                'snapshot_type' => PeriodClosingSnapshot::TYPE_INVENTORY_VALUE,
                'reference_id' => $stock->product_id,
                'reference_label' => $stock->product?->name,
                'amount' => round((float) $stock->quantity * (float) $stock->average_cost, 2),
                'quantity' => $stock->quantity,
                'metadata' => [
                    'warehouse_id' => $stock->warehouse_id,
                    'average_cost' => (float) $stock->average_cost,
                ],
            ]);
        });
    }
}
