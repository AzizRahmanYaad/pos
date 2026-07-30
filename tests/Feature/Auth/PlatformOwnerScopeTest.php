<?php

namespace Tests\Feature\Auth;

use App\Models\Tenant;
use App\Models\User;
use App\Support\Permissions;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * The superadmin runs the platform — businesses, the accounts inside them,
 * and the audit trail of both. It runs no shop. This is where that line is
 * held: not a screen the menu happens not to show, but every operational
 * endpoint refusing the platform account outright.
 */
class PlatformOwnerScopeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    private function platformOwner(): User
    {
        $superadmin = User::factory()->create(['tenant_id' => null]);
        $superadmin->assignRole('superadmin');

        return $superadmin->refresh();
    }

    public function test_the_platform_account_holds_nothing_a_shop_trades_on(): void
    {
        $held = Permissions::rolePermissions()['superadmin'];

        $this->assertEqualsCanonicalizing([
            ...Permissions::forModule(Permissions::COMPANIES),
            ...Permissions::forModule(Permissions::USERS),
            ...Permissions::forModule(Permissions::ACTIVITY),
        ], $held);

        foreach ([Permissions::POS, Permissions::SALES, Permissions::PRODUCTS, Permissions::SETTINGS] as $module) {
            foreach (Permissions::forModule($module) as $permission) {
                $this->assertNotContains($permission, $held);
            }
        }
    }

    /**
     * The whole point of the account: opening businesses, the accounts
     * inside them, and reading back what those accounts did.
     */
    public function test_it_still_runs_the_businesses_and_their_accounts(): void
    {
        $superadmin = $this->platformOwner();

        foreach (['/api/v1/users', '/api/v1/tenants', '/api/v1/roles', '/api/v1/permissions', '/api/v1/activity-log'] as $url) {
            $this->actingAs($superadmin)->getJson($url)->assertOk();
        }
    }

    /** Your own name, password and session are yours whatever else you run. */
    public function test_its_own_account_screens_still_answer(): void
    {
        $superadmin = $this->platformOwner();

        $this->actingAs($superadmin)->getJson('/api/v1/auth/me')->assertOk();

        $this->actingAs($superadmin)
            ->putJson('/api/v1/auth/password', [
                'current_password' => 'password',
                'password' => 'Secret123!',
                'password_confirmation' => 'Secret123!',
            ])
            ->assertSuccessful();
    }

    /**
     * The business settings are a shop's own — its name on the invoice, its
     * currency, its tax rate. Reading them was open to anyone signed in,
     * which meant the platform account could pull a business's details out
     * of the system (and, having no business of its own, quietly create a
     * stray settings record on the way).
     */
    public function test_it_cannot_read_or_write_a_businesss_settings(): void
    {
        $superadmin = $this->platformOwner();

        $this->actingAs($superadmin)->getJson('/api/v1/settings')->assertForbidden();
        $this->actingAs($superadmin)->putJson('/api/v1/settings', ['company_name' => 'Mine now'])->assertForbidden();

        $this->assertDatabaseCount('business_settings', 0);
    }

    /**
     * Every operational endpoint, walked from the route table rather than
     * listed by hand — a module added tomorrow is covered the day it is
     * routed, without anybody remembering to come back here.
     */
    public function test_no_operational_endpoint_answers_the_platform_account(): void
    {
        $superadmin = $this->platformOwner();
        $refused = 0;

        foreach ($this->operationalRoutes() as [$method, $uri]) {
            $status = $this->actingAs($superadmin)->json($method, '/'.$uri, [])->getStatusCode();

            $this->assertSame(403, $status, "{$method} /{$uri} answered the platform account with {$status}");
            $refused++;
        }

        // A route table that stopped matching would otherwise pass silently.
        $this->assertGreaterThan(30, $refused);
    }

    /** A denied attempt is worth knowing about, so it still reaches the log. */
    public function test_an_attempt_on_a_shops_screens_is_recorded(): void
    {
        $superadmin = $this->platformOwner();

        $this->actingAs($superadmin)->postJson('/api/v1/products', ['name' => 'Rice'])->assertForbidden();

        $this->assertDatabaseHas('activity_log', [
            'causer_id' => $superadmin->id,
            'log_name' => Permissions::PRODUCTS,
            'event' => 'denied',
        ]);
    }

    /**
     * The confinement is aimed at the platform account alone: a shop's own
     * staff must be untouched by it, including the settings the application
     * header reads on every screen.
     */
    public function test_a_shops_own_staff_are_not_caught_by_it(): void
    {
        $tenant = Tenant::create(['name' => 'Kabul Mart']);

        $admin = User::factory()->create(['tenant_id' => $tenant->id]);
        $admin->assignRole('admin');

        $cashier = User::factory()->create(['tenant_id' => $tenant->id, 'created_by' => $admin->id]);
        $this->grantRole($cashier, 'cashier');

        // The first read of a new business's settings writes its defaults,
        // which is why this is a 201 rather than a 200.
        $this->actingAs($admin->refresh())->getJson('/api/v1/settings')->assertSuccessful();
        $this->actingAs($admin->refresh())->getJson('/api/v1/products')->assertOk();

        // The header shows the shop's name to whoever is on the till.
        $this->actingAs($cashier->refresh())->getJson('/api/v1/settings')->assertSuccessful();
    }

    /**
     * Every route the platform account has no business on: the API, less
     * its own account and the administration modules it exists to run.
     *
     * @return array<int, array{0:string, 1:string}>
     */
    private function operationalRoutes(): array
    {
        $administration = ['auth', 'users', 'tenants', 'roles', 'permissions', 'activity-log'];
        $routes = [];

        foreach (Route::getRoutes() as $route) {
            $uri = $route->uri();

            // Routes taking a record need one to exist, and a platform
            // account that cannot reach the list cannot reach a record
            // either; the module gate is the same call in both cases.
            if (! str_starts_with($uri, 'api/v1/') || str_contains($uri, '{')) {
                continue;
            }

            if (in_array(explode('/', $uri)[2], $administration, true)) {
                continue;
            }

            foreach (array_diff($route->methods(), ['HEAD', 'OPTIONS']) as $method) {
                $routes[] = [$method, $uri];
            }
        }

        return $routes;
    }
}
