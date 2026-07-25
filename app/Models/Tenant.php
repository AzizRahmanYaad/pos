<?php

namespace App\Models;

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

    /**
     * How many accounts this business currently has. Counted directly
     * rather than through the relation so it stays correct regardless of
     * what the caller happens to have eager-loaded.
     */
    public function userCount(): int
    {
        return $this->users()->count();
    }

    /**
     * Whether the business has used up the account allowance the platform
     * owner granted it. A null limit means no ceiling.
     */
    public function hasReachedUserLimit(): bool
    {
        return $this->max_users !== null && $this->userCount() >= $this->max_users;
    }

    /** Remaining accounts, or null when the business has no ceiling. */
    public function remainingUserSlots(): ?int
    {
        return $this->max_users === null ? null : max(0, $this->max_users - $this->userCount());
    }
}
