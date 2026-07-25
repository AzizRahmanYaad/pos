<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use App\Support\Permissions;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * The upgrade from the old coarse `module.manage` permissions to the
 * granular matrix runs once, against a live database full of real accounts.
 * Nobody may lose access to something they could do the day before, and
 * nobody may quietly gain anything either.
 */
class PermissionUpgradeTest extends TestCase
{
    use RefreshDatabase;

    /** @var string[] */
    private array $legacyManagerPermissions = [
        'pos.access', 'products.manage', 'inventory.manage', 'purchases.manage',
        'sales.manage', 'sales.view-all', 'ledger.view', 'payments.manage',
        'expenses.manage', 'employees.manage', 'payroll.manage',
        'period-closing.close', 'reports.view',
    ];

    /**
     * Rewind the permission tables to how they looked before the upgrade:
     * only coarse permissions, all authority carried by the roles.
     */
    private function restoreLegacyState(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        DB::table('role_has_permissions')->delete();
        DB::table('model_has_permissions')->delete();
        DB::table('permissions')->delete();

        foreach (array_keys(Permissions::legacyMap()) as $name) {
            DB::table('permissions')->insert([
                'name' => $name, 'guard_name' => 'web', 'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        $permissionIds = DB::table('permissions')->pluck('id', 'name');
        $managerRoleId = DB::table('roles')->where('name', 'manager')->value('id');

        foreach ($this->legacyManagerPermissions as $name) {
            DB::table('role_has_permissions')->insert([
                'permission_id' => $permissionIds[$name], 'role_id' => $managerRoleId,
            ]);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    private function runUpgrade(): void
    {
        $migration = require database_path('migrations/2026_07_25_100001_convert_permissions_to_granular_matrix.php');
        $migration->up();

        // The deploy runs the seeder straight after the migration; that is
        // the step which strips the now label-only staff roles.
        (new RolesAndPermissionsSeeder())->run();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function test_an_existing_manager_keeps_every_ability_they_had(): void
    {
        $this->restoreLegacyState();

        $manager = User::factory()->create();
        $manager->assignRole('manager');

        $this->runUpgrade();
        $manager = $manager->fresh();

        // Each coarse permission they held becomes the granular set it
        // stood for — including the slugs that survive verbatim.
        foreach ($this->legacyManagerPermissions as $legacy) {
            foreach (Permissions::legacyMap()[$legacy] as $granular) {
                $this->assertTrue(
                    $manager->can($granular),
                    "manager lost {$granular}, which used to come from {$legacy}",
                );
            }
        }
    }

    public function test_the_upgrade_grants_nothing_that_was_not_held_before(): void
    {
        $this->restoreLegacyState();

        $manager = User::factory()->create();
        $manager->assignRole('manager');

        $this->runUpgrade();
        $manager = $manager->fresh();

        // Never held users.manage or settings.manage, so none of what they
        // unlocked may appear.
        foreach (['users.create', 'users.delete', 'settings.edit', 'companies.view', 'companies.edit', 'period-closing.reopen'] as $permission) {
            $this->assertFalse($manager->can($permission), "manager gained {$permission} in the upgrade");
        }
    }

    public function test_authority_moves_onto_the_account_so_it_survives_the_role_being_emptied(): void
    {
        $this->restoreLegacyState();

        $manager = User::factory()->create();
        $manager->assignRole('manager');

        $this->runUpgrade();

        // Staff roles are label-only afterwards...
        $this->assertSame(0, DB::table('role_has_permissions')
            ->where('role_id', DB::table('roles')->where('name', 'manager')->value('id'))
            ->count());

        // ...so the access has to be sitting on the account itself.
        $this->assertGreaterThan(0, $manager->fresh()->permissions()->count());
        $this->assertTrue($manager->fresh()->hasRole('manager'));
    }

    public function test_retired_permissions_are_removed_but_surviving_ones_are_kept(): void
    {
        $this->restoreLegacyState();
        $this->runUpgrade();

        $names = DB::table('permissions')->pluck('name');

        // Coarse slugs with no place in the new matrix are gone...
        $this->assertNotContains('products.manage', $names);
        $this->assertNotContains('sales.manage', $names);
        $this->assertNotContains('users.manage', $names);

        // ...while the ones that are still real permissions remain.
        $this->assertContains('pos.access', $names);
        $this->assertContains('reports.view', $names);
        $this->assertContains('period-closing.close', $names);

        $this->assertEqualsCanonicalizing(Permissions::all(), $names->all());
    }
}
