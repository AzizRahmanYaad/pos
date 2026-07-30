<?php

namespace Tests\Feature\Platform;

use App\Domain\Inventory\Actions\RecordStockMovementAction;
use App\Domain\Sales\Actions\CreateSaleAction;
use App\Models\Activity;
use App\Models\CashAccount;
use App\Models\Customer;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\TenantContext;
use App\Support\TenantProvisioner;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Emptying the platform of businesses. The one thing that must survive is
 * the account that can open the next one — everything else about a shop
 * goes, including the trail it left.
 */
class PurgeBusinessesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    private function platformOwner(): User
    {
        $superadmin = User::factory()->create(['tenant_id' => null, 'name' => 'Platform Owner']);
        $superadmin->assignRole('superadmin');

        return $superadmin->refresh();
    }

    /** A business with an owner, a cashier, stock and a day's takings. */
    private function tradingBusiness(User $openedBy): Tenant
    {
        $tenant = Tenant::create(['name' => 'Kabul Mart']);
        app(TenantProvisioner::class)->provision($tenant);

        $admin = User::factory()->create(['tenant_id' => $tenant->id, 'created_by' => $openedBy->id]);
        $admin->assignRole('admin');

        $cashier = User::factory()->create(['tenant_id' => $tenant->id, 'created_by' => $admin->id]);
        $this->grantRole($cashier, 'cashier');

        TenantContext::run($tenant->id, function () use ($cashier) {
            $warehouse = Warehouse::query()->first() ?? Warehouse::factory()->create();
            $cash = CashAccount::query()->first() ?? CashAccount::factory()->create();
            $product = Product::factory()->create(['sale_price' => 25]);
            Customer::factory()->create();

            app(RecordStockMovementAction::class)->execute(
                $product, $warehouse, StockMovement::TYPE_OPENING, 50, 10,
            );

            app(CreateSaleAction::class)->execute(
                data: ['warehouse_id' => $warehouse->id],
                items: [['product_id' => $product->id, 'quantity' => 2, 'unit_id' => $product->unit_id, 'unit_price' => 25]],
                payments: [['cash_account_id' => $cash->id, 'method' => 'cash', 'amount' => 50]],
                cashierId: $cashier->id,
            );
        });

        return $tenant;
    }

    public function test_it_leaves_the_platform_account_and_takes_everything_else(): void
    {
        $owner = $this->platformOwner();
        $this->tradingBusiness($owner);
        $this->tradingBusiness($owner);

        // The premise: there is something to delete.
        $this->assertGreaterThan(0, DB::table('sales')->count());
        $this->assertSame(4, DB::table('users')->whereNot('id', $owner->id)->count());

        $this->artisan('platform:purge-businesses --force')->assertSuccessful();

        foreach ([
            'tenants', 'sales', 'sale_items', 'sale_payments', 'products', 'product_stocks',
            'stock_movements', 'customers', 'suppliers', 'warehouses', 'cash_accounts',
            'ledger_entries', 'business_settings', 'categories', 'units', 'expense_categories',
        ] as $table) {
            $this->assertSame(0, DB::table($table)->count(), "{$table} still has rows");
        }

        // The account that can open the next business is still there, with
        // everything it needs to sign in and do so.
        $this->assertSame(1, DB::table('users')->count());
        $this->assertTrue($owner->fresh()->can('users.create'));
        $this->assertTrue($owner->fresh()->can('companies.view'));

        // And the roles the application is built on are untouched.
        $this->assertSame(4, DB::table('roles')->count());
    }

    /** A shop's history goes with the shop; the platform's own does not. */
    public function test_it_takes_the_businesses_trail_and_keeps_the_platforms(): void
    {
        $owner = $this->platformOwner();
        $tenant = $this->tradingBusiness($owner);

        Activity::withoutGlobalScopes()->create([
            'tenant_id' => null,
            'log_name' => 'companies',
            'description' => 'created',
            'event' => 'created',
            'causer_type' => User::class,
            'causer_id' => $owner->id,
        ]);

        $this->assertGreaterThan(0, Activity::withoutGlobalScopes()->where('tenant_id', $tenant->id)->count());

        $doomed = User::query()->where('tenant_id', $tenant->id)->pluck('id')->all();

        $this->artisan('platform:purge-businesses --force')->assertSuccessful();

        $left = Activity::withoutGlobalScopes()->get();

        // Nothing a business did, and nothing done by an account that has
        // gone with it.
        $this->assertSame(0, $left->whereNotNull('tenant_id')->count());
        $this->assertSame(0, $left->whereIn('causer_id', $doomed)->count());

        // The platform's own record of opening the company is still there.
        $this->assertTrue($left->contains(
            fn ($entry) => $entry->log_name === 'companies' && $entry->causer_id === $owner->id,
        ));
    }

    /** Nothing to sign in with afterwards would be worse than not running. */
    public function test_it_refuses_to_run_when_there_is_no_platform_account(): void
    {
        $tenant = Tenant::create(['name' => 'Kabul Mart']);
        $admin = User::factory()->create(['tenant_id' => $tenant->id]);
        $admin->assignRole('admin');

        $this->artisan('platform:purge-businesses --force')->assertFailed();

        $this->assertSame(1, DB::table('users')->count());
        $this->assertSame(1, DB::table('tenants')->count());
    }

    /** It is a command and nothing else: no deploy step runs it. */
    public function test_a_deploy_does_not_recreate_a_business_afterwards(): void
    {
        $this->platformOwner();
        $this->tradingBusiness(User::query()->first());

        $this->assertSame(0, Artisan::call('platform:purge-businesses', ['--force' => true]));

        // What remote-release.sh runs on every deploy.
        $this->app['env'] = 'production';
        config(['app.env' => 'production']);
        Artisan::call('db:seed', ['--class' => DatabaseSeeder::class, '--force' => true]);

        $this->assertSame(0, DB::table('tenants')->count());
        $this->assertNull(DB::table('users')->where('email', 'admin@example.com')->first());
    }
}
