<?php

namespace App\Models;

use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;
use Spatie\Activitylog\Models\Activity as SpatieActivity;

/**
 * One recorded action. Everything a signed-in user does that changes data —
 * plus the sign-ins, exports and refusals that change nothing but still
 * matter — lands here.
 *
 * The log is the one table that would otherwise read across every business
 * at once, so it carries its own tenant_id and is scoped like all the rest.
 */
class Activity extends SpatieActivity
{
    /**
     * How many entries this request has written so far. The request-level
     * recorder uses it to tell "the action was already described in detail
     * by a model event" from "nothing recorded this at all".
     */
    public static int $recordedThisRequest = 0;

    protected static function booted(): void
    {
        static::addGlobalScope('tenant', function (Builder $query) {
            $tenantId = TenantContext::id();

            if ($tenantId !== null) {
                $query->where($query->getModel()->getTable().'.tenant_id', $tenantId);
            }
        });

        static::creating(function (self $activity) {
            $activity->tenant_id ??= $activity->resolveTenantId();
            $activity->rememberSubjectLabel();

            // Only a real HTTP request has an origin worth recording; a
            // scheduled command would otherwise be stamped "127.0.0.1".
            if (request()->server->has('REQUEST_METHOD')) {
                $activity->ip_address ??= request()->ip();
                $activity->user_agent ??= Str::limit((string) request()->userAgent(), 250, '');
            }
        });

        static::created(function () {
            static::$recordedThisRequest++;
        });
    }

    /**
     * Copy the record's own name onto the entry while the record still
     * exists, so a deletion still reads as "deleted Rice 5kg" a year later.
     */
    private function rememberSubjectLabel(): void
    {
        if (! $this->relationLoaded('subject')) {
            return;
        }

        $subject = $this->getRelation('subject');

        if ($subject === null || ! method_exists($subject, 'activityLabel')) {
            return;
        }

        $this->properties = ($this->properties ?? collect())->put('subject_label', $subject->activityLabel());
    }

    /**
     * The business the entry belongs to. Taken from the record acted on
     * where there is one — a platform owner editing a company's product is
     * that company's history, not the platform's — and otherwise from
     * whoever is signed in.
     */
    private function resolveTenantId(): ?int
    {
        // relationLoaded, not ->subject: performedOn() associates the model,
        // so this never costs a query — and a subject that has since been
        // deleted would not come back from one anyway.
        if ($this->relationLoaded('subject')) {
            $tenantId = $this->getRelation('subject')?->getAttribute('tenant_id');

            if ($tenantId !== null) {
                return (int) $tenantId;
            }
        }

        return TenantContext::id();
    }
}
