<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

#[Fillable(['period_type', 'period_start', 'period_end', 'closed_at', 'closed_by', 'status', 'notes'])]
class PeriodClosing extends Model
{
    use BelongsToTenant;

    use LogsActivity;

    public const TYPE_DAILY = 'daily';

    public const TYPE_MONTHLY = 'monthly';

    public const TYPE_CUSTOM = 'custom';

    public const STATUS_CLOSED = 'closed';

    public const STATUS_REOPENED = 'reopened';

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
            'closed_at' => 'datetime',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['status', 'notes'])
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn (string $eventName) => match ($eventName) {
                'created' => 'period_closed',
                'updated' => $this->status === self::STATUS_REOPENED ? 'period_reopened' : 'period_updated',
                default => $eventName,
            });
    }

    public function snapshots(): HasMany
    {
        return $this->hasMany(PeriodClosingSnapshot::class);
    }

    public function closer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    /**
     * The audit trail of this closing — who closed it and, if applicable,
     * who reopened it and when. Displayed as a chronological log on the
     * Clearance detail page.
     */
    public function activities(): MorphMany
    {
        return $this->activitiesAsSubject();
    }
}
