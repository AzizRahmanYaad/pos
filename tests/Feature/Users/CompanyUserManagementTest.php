<?php

namespace Tests\Feature\Users;

use App\Models\Tenant;
use App\Models\User;
use App\Support\Permissions;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CompanyUserManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    private function superadmin(): User
    {
        $user = User::factory()->create();
        $user->assignRole('superadmin');

        return $user;
    }

    private function companyAdmin(Tenant $tenant): User
    {
        $user = User::factory()->create(['tenant_id' => $tenant->id]);
        $user->assignRole('admin');

        return $user;
    }

    public function test_company_admin_can_create_a_user_in_their_own_business(): void
    {
        $tenant = Tenant::create(['name' => 'Kabul Mart']);
        $admin = $this->companyAdmin($tenant);

        $this->actingAs($admin)->postJson('/api/v1/users', [
            'name' => 'New Cashier',
            'email' => 'cashier@kabul.test',
            'password' => 'Secret123!',
            'password_confirmation' => 'Secret123!',
            'locale' => 'en',
            'is_active' => true,
            'roles' => ['cashier'],
            'permissions' => Permissions::presets()['cashier'],
        ])->assertCreated()->assertJsonPath('data.tenant_id', $tenant->id);

        $created = User::query()->where('email', 'cashier@kabul.test')->firstOrFail();
        $this->assertTrue($created->can('pos.access'));
        $this->assertFalse($created->can('users.create'));
    }

    public function test_company_admin_cannot_reach_a_user_in_another_business(): void
    {
        $mine = Tenant::create(['name' => 'Mine']);
        $theirs = Tenant::create(['name' => 'Theirs']);

        $admin = $this->companyAdmin($mine);
        $outsider = User::factory()->create(['tenant_id' => $theirs->id]);

        $this->actingAs($admin)->getJson("/api/v1/users/{$outsider->id}")->assertForbidden();
        $this->actingAs($admin)->putJson("/api/v1/users/{$outsider->id}", ['name' => 'Renamed'])->assertForbidden();
        $this->actingAs($admin)->deleteJson("/api/v1/users/{$outsider->id}")->assertForbidden();

        $this->assertSame($outsider->name, $outsider->fresh()->name);
    }

    /**
     * The tenant a staff account joins is taken from the admin creating it,
     * never from the request body — otherwise a Company Admin could plant
     * an account inside somebody else's business.
     */
    public function test_company_admin_cannot_place_a_user_in_another_business(): void
    {
        $mine = Tenant::create(['name' => 'Mine']);
        $theirs = Tenant::create(['name' => 'Theirs']);
        $admin = $this->companyAdmin($mine);

        $this->actingAs($admin)->postJson('/api/v1/users', [
            'name' => 'Planted',
            'email' => 'planted@example.test',
            'password' => 'Secret123!',
            'password_confirmation' => 'Secret123!',
            'locale' => 'en',
            'roles' => ['cashier'],
            'tenant_id' => $theirs->id,
        ])->assertCreated();

        $this->assertSame($mine->id, User::query()->where('email', 'planted@example.test')->value('tenant_id'));
    }

    public function test_company_admin_cannot_create_a_platform_superadmin(): void
    {
        $tenant = Tenant::create(['name' => 'Kabul Mart']);
        $admin = $this->companyAdmin($tenant);

        $this->actingAs($admin)->postJson('/api/v1/users', [
            'name' => 'Sneaky',
            'email' => 'sneaky@example.test',
            'password' => 'Secret123!',
            'password_confirmation' => 'Secret123!',
            'locale' => 'en',
            'roles' => ['superadmin'],
        ])->assertJsonValidationErrors('roles.0');
    }

    /** Nobody hands out access they do not hold themselves. */
    public function test_a_manager_cannot_grant_permissions_beyond_their_own(): void
    {
        $tenant = Tenant::create(['name' => 'Kabul Mart']);
        $manager = User::factory()->create(['tenant_id' => $tenant->id]);
        $this->grantRole($manager, 'manager');
        $manager->givePermissionTo('users.view', 'users.create');

        $this->actingAs($manager->refresh())->postJson('/api/v1/users', [
            'name' => 'Over-privileged',
            'email' => 'over@example.test',
            'password' => 'Secret123!',
            'password_confirmation' => 'Secret123!',
            'locale' => 'en',
            'roles' => ['cashier'],
            // A manager holds no settings.edit, so cannot pass it on.
            'permissions' => ['pos.access', 'settings.edit'],
        ])->assertJsonValidationErrors('permissions.1');
    }

    public function test_creation_is_blocked_once_the_business_reaches_its_user_limit(): void
    {
        $tenant = Tenant::create(['name' => 'Small Shop', 'max_users' => 2]);
        $admin = $this->companyAdmin($tenant);

        // The allowance governs staff, so the admin's own account does not
        // eat into it — two staff is what fills a limit of two.
        User::factory()->count(2)->create(['tenant_id' => $tenant->id, 'created_by' => $admin->id]);

        $this->assertSame(2, $tenant->fresh()->staffCount());

        $response = $this->actingAs($admin)->postJson('/api/v1/users', [
            'name' => 'One Too Many',
            'email' => 'extra@example.test',
            'password' => 'Secret123!',
            'password_confirmation' => 'Secret123!',
            'locale' => 'en',
            'roles' => ['cashier'],
        ])->assertJsonValidationErrors('limit');

        $this->assertStringContainsString('2', $response->json('errors.limit.0'));
        $this->assertDatabaseMissing('users', ['email' => 'extra@example.test']);
    }

    public function test_freeing_a_slot_lets_the_business_create_again(): void
    {
        $tenant = Tenant::create(['name' => 'Small Shop', 'max_users' => 2]);
        $admin = $this->companyAdmin($tenant);
        User::factory()->create(['tenant_id' => $tenant->id, 'created_by' => $admin->id]);
        $spare = User::factory()->create(['tenant_id' => $tenant->id, 'created_by' => $admin->id]);

        $this->actingAs($admin)->deleteJson("/api/v1/users/{$spare->id}")->assertNoContent();

        $this->actingAs($admin)->postJson('/api/v1/users', [
            'name' => 'Replacement',
            'email' => 'replacement@example.test',
            'password' => 'Secret123!',
            'password_confirmation' => 'Secret123!',
            'locale' => 'en',
            'roles' => ['cashier'],
        ])->assertCreated();
    }

    public function test_the_users_list_reports_where_the_business_stands_against_its_limit(): void
    {
        $tenant = Tenant::create(['name' => 'Small Shop', 'max_users' => 3]);
        $admin = $this->companyAdmin($tenant);

        // Fresh business: the admin exists but has hired nobody yet, so the
        // whole allowance is still available to them.
        $this->actingAs($admin)->getJson('/api/v1/users')
            ->assertOk()
            ->assertJsonPath('limit.max_users', 3)
            ->assertJsonPath('limit.user_count', 0)
            ->assertJsonPath('limit.remaining', 3)
            ->assertJsonPath('limit.reached', false);
    }

    public function test_only_the_platform_owner_sets_a_business_user_limit(): void
    {
        $tenant = Tenant::create(['name' => 'Kabul Mart']);
        $admin = $this->companyAdmin($tenant);

        // A Company Admin raising their own ceiling would make it pointless.
        $this->actingAs($admin)->putJson("/api/v1/tenants/{$tenant->id}", ['max_users' => 99])->assertForbidden();
        $this->actingAs($admin)->getJson('/api/v1/tenants')->assertForbidden();

        $this->actingAs($this->superadmin())
            ->putJson("/api/v1/tenants/{$tenant->id}", ['max_users' => 5])
            ->assertOk()
            ->assertJsonPath('max_users', 5);

        $this->assertSame(5, $tenant->fresh()->max_users);
    }

    public function test_a_null_limit_means_no_ceiling(): void
    {
        $tenant = Tenant::create(['name' => 'Unlimited', 'max_users' => null]);
        $admin = $this->companyAdmin($tenant);

        foreach (range(1, 3) as $index) {
            $this->actingAs($admin)->postJson('/api/v1/users', [
                'name' => "Staff {$index}",
                'email' => "staff{$index}@example.test",
                'password' => 'Secret123!',
                'password_confirmation' => 'Secret123!',
                'locale' => 'en',
                'roles' => ['cashier'],
            ])->assertCreated();
        }

        $this->assertSame(3, $tenant->fresh()->staffCount());
    }

    public function test_the_permission_catalogue_never_offers_more_than_the_admin_holds(): void
    {
        $tenant = Tenant::create(['name' => 'Kabul Mart']);
        $admin = $this->companyAdmin($tenant);

        $response = $this->actingAs($admin)->getJson('/api/v1/permissions')->assertOk();

        $offered = collect($response->json('modules'))
            ->flatMap(fn (array $module) => array_column($module['actions'], 'permission'));

        $this->assertNotEmpty($offered);
        $this->assertEmpty($offered->diff($admin->grantablePermissions()));
        // Platform-owner modules are never a company's to delegate.
        $this->assertFalse($offered->contains('companies.edit'));
    }
}
