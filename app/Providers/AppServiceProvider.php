<?php

namespace App\Providers;

use App\Listeners\RecordAuthenticationActivity;
use App\Models\CashAccount;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\Warehouse;
use App\Observers\CashAccountObserver;
use App\Observers\CustomerObserver;
use App\Observers\ProductObserver;
use App\Observers\SupplierObserver;
use App\Observers\WarehouseObserver;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if ($this->app->isProduction()) {
            URL::forceScheme('https');
        }

        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(120)->by($request->user()?->id ?: $request->ip());
        });

        Event::listen(Login::class, [RecordAuthenticationActivity::class, 'recordLogin']);
        Event::listen(Logout::class, [RecordAuthenticationActivity::class, 'recordLogout']);
        Event::listen(Failed::class, [RecordAuthenticationActivity::class, 'recordFailure']);
        Event::listen(PasswordReset::class, [RecordAuthenticationActivity::class, 'recordPasswordReset']);

        Product::observe(ProductObserver::class);
        Warehouse::observe(WarehouseObserver::class);
        Customer::observe(CustomerObserver::class);
        Supplier::observe(SupplierObserver::class);
        CashAccount::observe(CashAccountObserver::class);
    }
}
