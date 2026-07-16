<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

#[Fillable(['period_type', 'period_start', 'period_end', 'closed_at', 'closed_by', 'status', 'notes'])]
class PeriodClosing extends Model
{
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
            ->logOnlyDirty();
    }

    public function snapshots(): HasMany
    {
        return $this->hasMany(PeriodClosingSnapshot::class);
    }

    public function closer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }
}
