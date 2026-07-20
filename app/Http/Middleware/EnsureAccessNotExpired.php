<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Blocks API access for accounts whose yearly access period has lapsed,
 * so an already-authenticated session stops working the moment the
 * subscription expires. The superadmin (null expiry) is never blocked.
 */
class EnsureAccessNotExpired
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()?->hasExpiredAccess()) {
            return response()->json([
                'message' => trans('auth.access_expired'),
                'code' => 'access_expired',
            ], 403);
        }

        return $next($request);
    }
}
