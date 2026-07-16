<?php

namespace App\Console\Commands;

use App\Domain\PeriodClosing\Actions\ClosePeriodAction;
use App\Domain\PeriodClosing\Exceptions\InvalidPeriodClosingException;
use App\Models\BusinessSetting;
use App\Models\PeriodClosing;
use Illuminate\Console\Command;

class CloseDailyPeriodCommand extends Command
{
    protected $signature = 'period:close-daily';

    protected $description = 'Auto-close yesterday as a daily accounting period, if enabled in business settings';

    public function handle(ClosePeriodAction $closePeriod): int
    {
        if (! BusinessSetting::current()->auto_close_daily) {
            $this->info('Auto daily close is disabled in business settings — skipping.');

            return self::SUCCESS;
        }

        $yesterday = now()->subDay();

        try {
            $closePeriod->execute(
                periodType: PeriodClosing::TYPE_DAILY,
                periodStart: $yesterday->copy()->startOfDay(),
                periodEnd: $yesterday->copy()->endOfDay(),
                closedBy: null,
                notes: 'Auto-closed by scheduler',
            );

            $this->info("Closed period for {$yesterday->toDateString()}.");
        } catch (InvalidPeriodClosingException $e) {
            $this->warn($e->getMessage());
        }

        return self::SUCCESS;
    }
}
