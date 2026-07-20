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
#[Fillable(['name'])]
class Tenant extends Model
{
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
