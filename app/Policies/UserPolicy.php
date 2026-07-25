<?php

namespace App\Policies;

use App\Models\User;
use App\Support\Permissions;

/**
 * Two very different people manage users here: the platform owner, who
 * works across every business, and a Company Admin, who works strictly
 * inside their own. Every check below therefore asks two questions — does
 * the actor hold the permission, and is the target inside a business they
 * are allowed to touch at all.
 */
class UserPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can(Permissions::of(Permissions::USERS, Permissions::VIEW));
    }

    public function view(User $user, User $target): bool
    {
        if ($user->is($target)) {
            return true;
        }

        return $user->can(Permissions::of(Permissions::USERS, Permissions::VIEW))
            && $user->managesSameBusinessAs($target);
    }

    public function create(User $user): bool
    {
        return $user->can(Permissions::of(Permissions::USERS, Permissions::CREATE));
    }

    public function update(User $user, User $target): bool
    {
        if ($user->is($target)) {
            return true;
        }

        return $user->can(Permissions::of(Permissions::USERS, Permissions::EDIT))
            && $user->managesSameBusinessAs($target);
    }

    public function delete(User $user, User $target): bool
    {
        return ! $user->is($target)
            && $user->can(Permissions::of(Permissions::USERS, Permissions::DELETE))
            && $user->managesSameBusinessAs($target);
    }

    /**
     * Renewing paid access is the platform owner's business — a Company
     * Admin extending their own company's subscription would be marking
     * their own homework.
     */
    public function extend(User $user, User $target): bool
    {
        return $user->isPlatformOwner()
            && $user->can(Permissions::of(Permissions::USERS, Permissions::EDIT));
    }
}
