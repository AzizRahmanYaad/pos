<?php

namespace App\Models\Concerns;

use App\Support\ActivityModules;
use Illuminate\Support\Str;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

/**
 * Puts a model on the record: every create, edit and delete is written to
 * the activity log with the fields that changed, who changed them, and a
 * label for the record so the entry still reads sensibly long after the
 * record itself has been deleted.
 *
 * Attach this rather than Spatie's LogsActivity directly, so that the whole
 * application logs the same shape of entry.
 */
trait RecordsActivity
{
    use LogsActivity;

    /**
     * Never write these into the log. Secrets obviously, but also the
     * bookkeeping columns whose changing is not news to anybody.
     *
     * @var string[]
     */
    private const NEVER_LOGGED = [
        'password', 'remember_token', 'tenant_id', 'created_at', 'updated_at', 'deleted_at',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(array_values(array_diff($this->getFillable(), self::NEVER_LOGGED)))
            ->logExcept(self::NEVER_LOGGED)
            // Saving a form without touching anything is not an event.
            ->logOnlyDirty()
            ->dontLogEmptyChanges()
            ->useLogName(ActivityModules::for($this))
            ->setDescriptionForEvent(fn (string $event) => $event);
    }

    /**
     * What to call this record in the log. Frozen onto the entry as it is
     * written (see the Activity model), because the record itself may be
     * gone by the time anyone reads the log — and "deleted product #418" is
     * no use to an admin working out what happened. Models with a less
     * obvious name override this.
     */
    public function activityLabel(): string
    {
        $candidates = ['name', 'invoice_number', 'purchase_number', 'reference', 'code', 'title', 'description'];

        foreach ($candidates as $attribute) {
            $value = $this->getAttribute($attribute);

            if (is_string($value) && trim($value) !== '') {
                return Str::limit(trim($value), 80);
            }
        }

        return '#'.$this->getKey();
    }
}
