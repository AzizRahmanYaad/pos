<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Every API response carries data scoped to the authenticated user's
 * tenant — a shared-hosting reverse proxy or browser that caches these
 * by URL alone (ignoring the session cookie) would serve one tenant's
 * figures to another, or simply serve stale figures back after a change.
 * Force every hop between the app and the browser to skip caching.
 */
class PreventApiCaching
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private');
        $response->headers->set('Pragma', 'no-cache');

        return $response;
    }
}
