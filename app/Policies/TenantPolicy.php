<?php

namespace App\Policies;

use App\Models\Tenant;
use App\Models\User;
use App\Support\Permissions;

/**
 * Businesses are platform-owner territory: only they see the full list and
 * only they set how many accounts each business may create. A Company
 * Admin never reaches this — raising their own ceiling would make the
 * limit meaningless.
 */
class TenantPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can(Permissions::of(Permissions::COMPANIES, Permissions::VIEW));
    }

    public function update(User $user, Tenant $tenant): bool
    {
        return $user->can(Permissions::of(Permissions::COMPANIES, Permissions::EDIT));
    }
}
