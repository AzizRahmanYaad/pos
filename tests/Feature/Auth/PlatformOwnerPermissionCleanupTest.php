<?php

namespace Tests\Feature\Auth;

use App\Models\Tenant;
use App\Models\User;
use App\Support\Permissions;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * The migration that takes a shop's permissions off the platform accounts,
 * run against a database that has them — which is what an installation
 * upgraded from an earlier version of this application looks like.
 */
class PlatformOwnerPermissionCleanupTest extends TestCase
{
    use RefreshDatabase;

    private const MIGRATION = '2026_07_30_120000_confine_platform_owners_to_administration';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    /** Run the migration again, as an upgrade of an existing database would. */
    private function rerunTheMigration(): void
    {
        DB::table('migrations')->where('migration', self::MIGRATION)->delete();

        Artisan::call('migrate', ['--force' => true]);
    }

    public function test_it_takes_a_shops_permissions_off_the_platform_account(): void
    {
        $superadmin = User::factory()->create(['tenant_id' => null]);
        $superadmin->assignRole('superadmin');
        $superadmin->givePermissionTo([
            Permissions::of(Permissions::POS, Permissions::ACCESS),
            Permissions::of(Permissions::SALES, Permissions::VIEW),
            // Granted directly as well as through the role; its own remit
            // stays whichever way it was given.
            Permissions::of(Permissions::USERS, Permissions::VIEW),
        ]);

        $this->rerunTheMigration();

        $left = $superadmin->fresh()->permissions->pluck('name');

        $this->assertEqualsCanonicalizing([Permissions::of(Permissions::USERS, Permissions::VIEW)], $left->all());
        $this->assertTrue($superadmin->fresh()->can(Permissions::of(Permissions::USERS, Permissions::VIEW)));
    }

    public function test_a_shops_own_accounts_are_left_exactly_as_they_were(): void
    {
        $tenant = Tenant::create(['name' => 'Kabul Mart']);

        $admin = User::factory()->create(['tenant_id' => $tenant->id]);
        $admin->assignRole('admin');

        $cashier = User::factory()->create(['tenant_id' => $tenant->id, 'created_by' => $admin->id]);
        $cashier->givePermissionTo(Permissions::presets()['cashier']);

        $before = $cashier->fresh()->permissions->pluck('name')->sort()->values()->all();

        $this->rerunTheMigration();

        $this->assertSame($before, $cashier->fresh()->permissions->pluck('name')->sort()->values()->all());
        $this->assertTrue($admin->fresh()->can(Permissions::of(Permissions::POS, Permissions::ACCESS)));
    }
}
