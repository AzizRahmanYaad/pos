<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('users.manage');
    }

    public function view(User $user, User $target): bool
    {
        return $user->can('users.manage') || $user->is($target);
    }

    public function update(User $user, User $target): bool
    {
        return $user->can('users.manage') || $user->is($target);
    }

    public function delete(User $user, User $target): bool
    {
        return $user->can('users.manage') && ! $user->is($target);
    }

    public function extend(User $user, User $target): bool
    {
        return $user->can('users.manage');
    }
}
