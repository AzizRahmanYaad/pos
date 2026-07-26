<?php

namespace App\Models;

use App\Models\Concerns\RecordsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A tenant is one business (POS account) on the platform. Every business
 * table carries a tenant_id, and the BelongsToTenant scope keeps each
 * business inside its own data.
 */
#[Fillable(['name', 'max_users'])]
class Tenant extends Model
{
    use RecordsActivity;

    /**
     * Staff accounts a new business may create before the platform owner
     * has to raise its ceiling.
     */
    public const DEFAULT_MAX_USERS = 5;

    protected function casts(): array
    {
        return [
            'max_users' => 'integer',
        ];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /** Every account in the business, owners included. */
    public function userCount(): int
    {
        return $this->users()->count();
    }

    /**
     * The staff accounts the allowance actually governs.
     *
     * The limit is what a Company Admin may take on, so the owner's own
     * account does not eat into it — a limit of five means five staff on
     * top of the admin, not four. Counted directly rather than through the
     * relation so it stays correct whatever the caller eager-loaded.
     */
    public function staffCount(): int
    {
        return $this->users()
            ->whereDoesntHave('roles', fn ($query) => $query->whereIn('name', ['admin', 'superadmin']))
            ->count();
    }

    /**
     * Whether the business has used up the staff allowance the platform
     * owner granted it. A null limit means no ceiling.
     */
    public function hasReachedUserLimit(): bool
    {
        return $this->max_users !== null && $this->staffCount() >= $this->max_users;
    }

    /** Remaining staff slots, or null when the business has no ceiling. */
    public function remainingUserSlots(): ?int
    {
        return $this->max_users === null ? null : max(0, $this->max_users - $this->staffCount());
    }
}
