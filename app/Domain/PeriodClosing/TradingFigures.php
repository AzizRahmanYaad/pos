<?php

namespace App\Domain\PeriodClosing;

use App\Domain\Reports\PeriodResults;
use App\Models\PeriodClosing;
use App\Models\PeriodClosingSnapshot;
use Illuminate\Support\Collection;

/**
 * What a closed period traded, whether or not anyone wrote it down.
 *
 * Closing a period records the trading figures as they stood at that
 * moment, and those recorded figures always win: a closed period is a
 * statement about a moment that has passed, and a backdated expense or a
 * reopened month must not quietly rewrite what the closing said at the
 * time.
 *
 * Periods closed before those figures were kept have no such statement to
 * protect. Showing them an em dash claims only that nobody saved a number,
 * which is true but useless — the shop still traded, and the sales,
 * expenses and payroll that prove it are all still on file. So for those
 * periods the figures are worked out now from the same records the
 * profit-and-loss report reads, and marked as computed rather than
 * recorded, so nobody mistakes a figure derived today for one that was
 * agreed when the books shut.
 */
class TradingFigures
{
    public const SOURCE_RECORDED = 'recorded';

    public const SOURCE_COMPUTED = 'computed';

    public function __construct(private PeriodResults $results = new PeriodResults) {}

    /**
     * Attach figures to every closing in a list, computing only for those
     * that lack recorded ones. The set needing computation is bounded by
     * the periods closed before the figures were kept, so it stops growing
     * the first time a period is closed by the current code.
     *
     * @param  Collection<int,PeriodClosing>  $closings
     * @return Collection<int,PeriodClosing>
     */
    public function attachToMany(Collection $closings): Collection
    {
        return $closings->each(fn (PeriodClosing $closing) => $this->attach($closing));
    }

    public function attach(PeriodClosing $closing): PeriodClosing
    {
        $closing->setAttribute('trading_figures', $this->for($closing));

        return $closing;
    }

    /**
     * @return array{source:string,revenue:float,discounts:float,net_revenue:float,cogs:float,gross_profit:float,operating_expenses:float,operating_expenses_by_category:array<int,array{category:string,total:float}>,payroll_cost:float,net_profit:float,purchases_total:float,sales_count:int}
     */
    public function for(PeriodClosing $closing): array
    {
        $recorded = $this->recordedSnapshots($closing);

        return $recorded->isNotEmpty()
            ? $this->fromSnapshots($recorded)
            : $this->compute($closing);
    }

    /**
     * @return Collection<int,PeriodClosingSnapshot>
     */
    private function recordedSnapshots(PeriodClosing $closing): Collection
    {
        // The list endpoint loads only the result snapshots and the detail
        // endpoint loads all of them; either way they are already in memory,
        // and re-querying here would undo that eager loading one row at a
        // time.
        $snapshots = $closing->relationLoaded('snapshots')
            ? $closing->snapshots
            : $closing->snapshots()->whereIn('snapshot_type', PeriodClosingSnapshot::RESULT_TYPES)->get();

        return $snapshots->whereIn('snapshot_type', PeriodClosingSnapshot::RESULT_TYPES)->values();
    }

    /**
     * @param  Collection<int,PeriodClosingSnapshot>  $snapshots
     */
    private function fromSnapshots(Collection $snapshots): array
    {
        $amount = fn (string $type) => (float) ($snapshots
            ->firstWhere('snapshot_type', $type)?->amount ?? 0);

        $expensesByCategory = $snapshots
            ->where('snapshot_type', PeriodClosingSnapshot::TYPE_OPERATING_EXPENSE)
            ->map(fn (PeriodClosingSnapshot $row) => [
                'category' => $row->reference_label,
                'total' => round((float) $row->amount, 2),
            ])
            ->sortByDesc('total')
            ->values()
            ->all();

        $revenue = $amount(PeriodClosingSnapshot::TYPE_REVENUE);
        $discounts = $amount(PeriodClosingSnapshot::TYPE_DISCOUNTS);

        // The sale count rides with the revenue row, the one figure here
        // that is a tally rather than money.
        $salesCount = (int) ($snapshots
            ->firstWhere('snapshot_type', PeriodClosingSnapshot::TYPE_REVENUE)?->quantity ?? 0);

        return [
            'source' => self::SOURCE_RECORDED,
            'revenue' => round($revenue, 2),
            'discounts' => round($discounts, 2),
            'net_revenue' => round($revenue - $discounts, 2),
            'cogs' => $amount(PeriodClosingSnapshot::TYPE_COGS),
            'gross_profit' => $amount(PeriodClosingSnapshot::TYPE_GROSS_PROFIT),
            'operating_expenses' => round(array_sum(array_column($expensesByCategory, 'total')), 2),
            'operating_expenses_by_category' => $expensesByCategory,
            'payroll_cost' => $amount(PeriodClosingSnapshot::TYPE_PAYROLL_COST),
            'net_profit' => $amount(PeriodClosingSnapshot::TYPE_NET_PROFIT),
            'purchases_total' => $amount(PeriodClosingSnapshot::TYPE_PURCHASES),
            'sales_count' => $salesCount,
        ];
    }

    private function compute(PeriodClosing $closing): array
    {
        $figures = $this->results->forRange(
            $closing->period_start->copy()->startOfDay(),
            $closing->period_end->copy()->endOfDay(),
        );

        return ['source' => self::SOURCE_COMPUTED] + $figures;
    }
}
