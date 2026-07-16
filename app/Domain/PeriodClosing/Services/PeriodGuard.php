<?php

namespace App\Domain\PeriodClosing\Services;

use App\Domain\PeriodClosing\Exceptions\PeriodClosedException;
use App\Models\PeriodClosing;
use Carbon\Carbon;
use Carbon\CarbonInterface;

class PeriodGuard
{
    /**
     * Reject writes dated on or before the latest closed period's end date.
     * Called by every Action that posts a dated financial/stock effect, so
     * closed periods stay immutable regardless of which module touches them.
     */
    public function assertMutable(CarbonInterface|string $date): void
    {
        $date = $date instanceof CarbonInterface ? $date : Carbon::parse($date);
        $cutoff = $this->latestClosedCutoff();

        if ($cutoff !== null && $date->lessThanOrEqualTo($cutoff)) {
            throw new PeriodClosedException(
                "The accounting period up to {$cutoff->toDateString()} is closed. ".
                'This date falls within it and can no longer be modified.'
            );
        }
    }

    public function latestClosedCutoff(): ?Carbon
    {
        $latest = PeriodClosing::query()
            ->where('status', PeriodClosing::STATUS_CLOSED)
            ->max('period_end');

        return $latest ? Carbon::parse($latest)->endOfDay() : null;
    }
}
