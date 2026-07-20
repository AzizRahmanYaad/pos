<?php

namespace App\Console\Commands;

use App\Domain\PeriodClosing\Actions\ClosePeriodAction;
use App\Domain\PeriodClosing\Exceptions\InvalidPeriodClosingException;
use App\Models\BusinessSetting;
use App\Models\PeriodClosing;
use App\Models\Tenant;
use App\Support\TenantContext;
use Illuminate\Console\Command;

class CloseDailyPeriodCommand extends Command
{
    protected $signature = 'period:close-daily';

    protected $description = 'Auto-close yesterday as a daily accounting period, if enabled in business settings';

    public function handle(ClosePeriodAction $closePeriod): int
    {
        $yesterday = now()->subDay();

        // Each tenant (business) closes its own books independently.
        foreach (Tenant::query()->pluck('id', 'name') as $name => $tenantId) {
            TenantContext::run($tenantId, function () use ($closePeriod, $yesterday, $name) {
                if (! BusinessSetting::current()->auto_close_daily) {
                    $this->info("[{$name}] auto daily close disabled — skipping.");

                    return;
                }

                try {
                    $closePeriod->execute(
                        periodType: PeriodClosing::TYPE_DAILY,
                        periodStart: $yesterday->copy()->startOfDay(),
                        periodEnd: $yesterday->copy()->endOfDay(),
                        closedBy: null,
                        notes: 'Auto-closed by scheduler',
                    );

                    $this->info("[{$name}] closed period for {$yesterday->toDateString()}.");
                } catch (InvalidPeriodClosingException $e) {
                    $this->warn("[{$name}] {$e->getMessage()}");
                }
            });
        }

        return self::SUCCESS;
    }
}
