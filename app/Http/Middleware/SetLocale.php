<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SetLocale
{
    /** @var string[] */
    public const SUPPORTED_LOCALES = ['en', 'ps', 'prs'];

    public function handle(Request $request, Closure $next): Response
    {
        $locale = $request->user()?->locale
            ?? $request->header('X-Locale')
            ?? $request->query('locale');

        if (is_string($locale) && in_array($locale, self::SUPPORTED_LOCALES, true)) {
            app()->setLocale($locale);
        }

        return $next($request);
    }
}
