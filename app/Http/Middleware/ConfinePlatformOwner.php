<?php

namespace App\Http\Middleware;

use App\Support\ActivityModules;
use App\Support\Permissions;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Keeps the platform owner out of the shop.
 *
 * The superadmin account exists to open businesses and the accounts inside
 * them, and to audit what those accounts do. It sells nothing, buys
 * nothing and banks nothing, so it holds none of the operational
 * permissions — every till, stock, money and reporting endpoint already
 * turns it away on that basis alone.
 *
 * This is the floor under that. Permissions are granted per account and can
 * be handed out by hand; an endpoint can also be added without a gate on
 * it, as the business settings once were, and then it is open to whoever
 * asks. Neither can reach a company's data through this middleware: the
 * platform owner is confined to the administration modules whatever their
 * permission rows happen to say, so a superadmin can never be talked,
 * granted or coded into a shop's own screens.
 *
 * Own-account endpoints — signing in and out, your own password, your own
 * name and photo — belong to everybody, platform owner included.
 */
class ConfinePlatformOwner
{
    /** What ActivityModules calls the endpoints that are simply yours. */
    private const OWN_ACCOUNT = 'account';

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user?->isPlatformOwner() && ! $this->isAdministration($request->path())) {
            return response()->json([
                'message' => trans('auth.platform_owner_scope'),
                'code' => 'platform_owner_scope',
            ], 403);
        }

        return $next($request);
    }

    /**
     * Whether the path belongs to the platform owner's own remit. Paths are
     * mapped to modules the same way the audit log names them, so "which
     * part of the application is this?" has one answer in the whole system.
     */
    private function isAdministration(string $path): bool
    {
        $module = ActivityModules::forPath($path);

        return $module === self::OWN_ACCOUNT
            || in_array($module, Permissions::platformOwnerModules(), true);
    }
}
