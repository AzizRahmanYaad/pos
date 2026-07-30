<?php

use App\Domain\Employees\Exceptions\PayrollAlreadyProcessedException;
use App\Domain\Expenses\Exceptions\InvalidExpenseException;
use App\Domain\Inventory\Exceptions\InsufficientStockException;
use App\Domain\PeriodClosing\Exceptions\InvalidPeriodClosingException;
use App\Domain\PeriodClosing\Exceptions\PeriodClosedException;
use App\Domain\Purchases\Exceptions\PurchaseAlreadyProcessedException;
use App\Domain\Sales\Exceptions\InvalidRefundException;
use App\Domain\Sales\Exceptions\InvalidSalePaymentException;
use App\Domain\Sales\Exceptions\SaleAlreadyProcessedException;
use App\Http\Middleware\ConfinePlatformOwner;
use App\Http\Middleware\EnsureAccessNotExpired;
use App\Http\Middleware\EnsureIdempotentWrites;
use App\Http\Middleware\PreventApiCaching;
use App\Http\Middleware\RecordRequestActivity;
use App\Http\Middleware\SetLocale;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;
use Spatie\Permission\Middleware\RoleOrPermissionMiddleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // The application never sees a visitor directly: on shared hosting
        // every request arrives through the provider's web server, which
        // puts the real client in X-Forwarded-For. Without this, Laravel
        // takes that front-end machine to be the visitor, and *every*
        // signed-out request in the country shares one identity.
        //
        // That is not cosmetic. The API rate limiter buckets guests by IP,
        // so one shop's staff signing in would spend a limit shared with
        // everyone else behind the same front end, and the rest would be
        // turned away at the login screen with no explanation. It also made
        // the audit log record the proxy against every action instead of
        // the person who took it.
        //
        // Trusting any proxy is the right setting here precisely because
        // the app cannot be reached except through that front end, which
        // replaces these headers rather than passing a visitor's through.
        $middleware->trustProxies(at: '*');

        $middleware->statefulApi();
        $middleware->throttleApi();
        // ConfinePlatformOwner goes last on purpose: it must sit *inside*
        // the activity recorder, so an attempt to reach a shop's screens
        // with the platform account is written to the log like any other
        // refusal, instead of being turned away before anything sees it.
        $middleware->api(append: [SetLocale::class, EnsureAccessNotExpired::class, PreventApiCaching::class, EnsureIdempotentWrites::class, RecordRequestActivity::class, ConfinePlatformOwner::class]);
        $middleware->web(append: [SetLocale::class]);
        $middleware->alias([
            'role' => RoleMiddleware::class,
            'permission' => PermissionMiddleware::class,
            'role_or_permission' => RoleOrPermissionMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );

        $exceptions->render(fn (InsufficientStockException $e, Request $request) => $request->is('api/*')
            ? response()->json(['message' => $e->getMessage()], 409)
            : null);

        $exceptions->render(fn (PurchaseAlreadyProcessedException $e, Request $request) => $request->is('api/*')
            ? response()->json(['message' => $e->getMessage()], 409)
            : null);

        $exceptions->render(fn (SaleAlreadyProcessedException $e, Request $request) => $request->is('api/*')
            ? response()->json(['message' => $e->getMessage()], 409)
            : null);

        $exceptions->render(fn (InvalidSalePaymentException $e, Request $request) => $request->is('api/*')
            ? response()->json(['message' => $e->getMessage()], 422)
            : null);

        $exceptions->render(fn (InvalidRefundException $e, Request $request) => $request->is('api/*')
            ? response()->json(['message' => $e->getMessage()], 422)
            : null);

        $exceptions->render(fn (InvalidExpenseException $e, Request $request) => $request->is('api/*')
            ? response()->json(['message' => $e->getMessage()], 422)
            : null);

        $exceptions->render(fn (PayrollAlreadyProcessedException $e, Request $request) => $request->is('api/*')
            ? response()->json(['message' => $e->getMessage()], 409)
            : null);

        $exceptions->render(fn (PeriodClosedException $e, Request $request) => $request->is('api/*')
            ? response()->json(['message' => $e->getMessage()], 423)
            : null);

        $exceptions->render(fn (InvalidPeriodClosingException $e, Request $request) => $request->is('api/*')
            ? response()->json(['message' => $e->getMessage()], 422)
            : null);
    })->create();
