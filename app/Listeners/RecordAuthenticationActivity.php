<?php

namespace App\Listeners;

use App\Models\User;
use App\Support\TenantContext;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Auth\Events\PasswordReset;

/**
 * Who signed in, from where, and when — plus the attempts that failed.
 *
 * A failed sign-in is the one entry nobody can produce by using the
 * application normally, which is exactly why it belongs in the log.
 */
class RecordAuthenticationActivity
{
    /*
     * Deliberately not named handle*: Laravel auto-discovers listeners in
     * this directory by that prefix, which would register each of these a
     * second time on top of the explicit bindings in AppServiceProvider —
     * and every sign-in would be logged twice.
     */

    public function recordLogin(Login $event): void
    {
        $this->record($event->user, 'signed-in', 'signed in');
    }

    public function recordLogout(Logout $event): void
    {
        if ($event->user !== null) {
            $this->record($event->user, 'signed-out', 'signed out');
        }
    }

    public function recordFailure(Failed $event): void
    {
        $email = $event->credentials['email'] ?? null;

        // A wrong password on a real account is worth naming; a wrong
        // address is just noise, so it is logged without a causer.
        activity('account')
            ->when($event->user instanceof User, fn ($logger) => $logger->causedBy($event->user))
            ->withProperties(['email' => $email])
            ->event('sign-in-failed')
            ->log('sign-in failed');
    }

    public function recordPasswordReset(PasswordReset $event): void
    {
        $this->record($event->user, 'password-reset', 'reset their password');
    }

    private function record(mixed $user, string $event, string $description): void
    {
        // The tenant scope reads the authenticated user, which on sign-out
        // has already been cleared — pin it explicitly so the entry lands in
        // the right business either way.
        TenantContext::run($user->tenant_id ?? null, function () use ($user, $event, $description) {
            activity('account')
                ->causedBy($user)
                ->event($event)
                ->log($description);
        });
    }
}
