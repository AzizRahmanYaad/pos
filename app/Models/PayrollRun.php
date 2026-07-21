<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['employee_id', 'period_month', 'period_year', 'period_date', 'status', 'paid_at', 'generated_by'])]
class PayrollRun extends Model
{
    use BelongsToTenant;

    use HasFactory;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_PAID = 'paid';

    protected function casts(): array
    {
        return [
            'paid_at' => 'datetime',
            'period_date' => 'date',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(PayrollItem::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function generator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'generated_by');
    }
}
