<?php

namespace App\Providers;

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

        Product::observe(ProductObserver::class);
        Warehouse::observe(WarehouseObserver::class);
        Customer::observe(CustomerObserver::class);
        Supplier::observe(SupplierObserver::class);
        CashAccount::observe(CashAccountObserver::class);
    }
}
