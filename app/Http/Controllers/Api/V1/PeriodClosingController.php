<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\PeriodClosing\Actions\ClosePeriodAction;
use App\Domain\PeriodClosing\Actions\ReopenPeriodAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\PeriodClosing\StorePeriodClosingRequest;
use App\Http\Resources\PeriodClosingResource;
use App\Models\PeriodClosing;
use Carbon\Carbon;

class PeriodClosingController extends Controller
{
    public function index()
    {
        $this->authorize('viewAny', PeriodClosing::class);

        return PeriodClosingResource::collection(
            PeriodClosing::query()->with('closer')->orderByDesc('period_end')->get()
        );
    }

    public function store(StorePeriodClosingRequest $request, ClosePeriodAction $closePeriod): PeriodClosingResource
    {
        $closing = $closePeriod->execute(
            periodType: $request->validated('period_type'),
            periodStart: Carbon::parse($request->validated('period_start')),
            periodEnd: Carbon::parse($request->validated('period_end')),
            closedBy: $request->user()->id,
            notes: $request->validated('notes'),
        );

        return new PeriodClosingResource($closing);
    }

    public function show(PeriodClosing $periodClosing): PeriodClosingResource
    {
        $this->authorize('viewAny', PeriodClosing::class);

        return new PeriodClosingResource($periodClosing->load(['snapshots', 'closer']));
    }

    public function reopen(PeriodClosing $periodClosing, ReopenPeriodAction $reopenPeriod): PeriodClosingResource
    {
        $this->authorize('reopen', PeriodClosing::class);

        $reopened = $reopenPeriod->execute($periodClosing);

        return new PeriodClosingResource($reopened->load('snapshots'));
    }
}
