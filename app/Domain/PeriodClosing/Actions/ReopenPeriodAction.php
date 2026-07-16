<?php

namespace App\Domain\PeriodClosing\Actions;

use App\Domain\PeriodClosing\Exceptions\InvalidPeriodClosingException;
use App\Models\PeriodClosing;

class ReopenPeriodAction
{
    /**
     * Reopen the most recently closed period only — reopening one further
     * back would leave a gap in the locked timeline while later periods
     * stay closed on top of it.
     */
    public function execute(PeriodClosing $closing, ?string $notes = null): PeriodClosing
    {
        if ($closing->status !== PeriodClosing::STATUS_CLOSED) {
            throw new InvalidPeriodClosingException('Only a closed period can be reopened.');
        }

        $latestClosedId = PeriodClosing::query()
            ->where('status', PeriodClosing::STATUS_CLOSED)
            ->orderByDesc('period_end')
            ->value('id');

        if ($latestClosedId !== $closing->id) {
            throw new InvalidPeriodClosingException('Only the most recently closed period can be reopened.');
        }

        $closing->update([
            'status' => PeriodClosing::STATUS_REOPENED,
            'notes' => $notes ?? $closing->notes,
        ]);

        return $closing;
    }
}
