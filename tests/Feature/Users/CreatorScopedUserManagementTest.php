<?php

namespace Tests\Feature\Users;

use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A Company Admin's reach stops at the staff they took on themselves. Two
 * admins can share a business without sharing — or being able to touch —
 * each other's people.
 */
class CreatorScopedUserManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    private function admin(Tenant $tenant): User
    {
        $user = User::factory()->create(['tenant_id' => $tenant->id]);
        $user->assignRole('admin');

        return $user->refresh();
    }

    private function staffOf(User $admin, string $name): User
    {
        return User::factory()->create([
            'tenant_id' => $admin->tenant_id,
            'created_by' => $admin->id,
            'name' => $name,
        ]);
    }

    public function test_an_admin_sees_their_own_staff_and_themselves_only(): void
    {
        $tenant = Tenant::create(['name' => 'Shared Shop']);
        $first = $this->admin($tenant);
        $second = $this->admin($tenant);

        $this->staffOf($first, 'First Cashier');
        $this->staffOf($second, 'Second Cashier');

        $names = collect($this->actingAs($first)->getJson('/api/v1/users')->assertOk()->json('data'))
            ->pluck('name');

        $this->assertContains('First Cashier', $names);
        $this->assertContains($first->name, $names);
        // The other admin, and everyone they hired, stay out of sight.
        $this->assertNotContains('Second Cashier', $names);
        $this->assertNotContains($second->name, $names);
    }

    public function test_an_admin_cannot_touch_another_admins_staff(): void
    {
        $tenant = Tenant::create(['name' => 'Shared Shop']);
        $first = $this->admin($tenant);
        $second = $this->admin($tenant);
        $theirs = $this->staffOf($second, 'Not Yours');

        $this->actingAs($first)->getJson("/api/v1/users/{$theirs->id}")->assertForbidden();
        $this->actingAs($first)->putJson("/api/v1/users/{$theirs->id}", ['name' => 'Hijacked'])->assertForbidden();
        $this->actingAs($first)->deleteJson("/api/v1/users/{$theirs->id}")->assertForbidden();

        $this->assertSame('Not Yours', $theirs->fresh()->name);
    }

    public function test_an_admin_cannot_touch_the_other_admin_either(): void
    {
        $tenant = Tenant::create(['name' => 'Shared Shop']);
        $first = $this->admin($tenant);
        $second = $this->admin($tenant);

        $this->actingAs($first)->getJson("/api/v1/users/{$second->id}")->assertForbidden();
        $this->actingAs($first)->deleteJson("/api/v1/users/{$second->id}")->assertForbidden();
    }

    public function test_accounts_an_admin_creates_are_stamped_as_theirs(): void
    {
        $tenant = Tenant::create(['name' => 'Kabul Mart']);
        $admin = $this->admin($tenant);

        $this->actingAs($admin)->postJson('/api/v1/users', [
            'name' => 'Hired',
            'email' => 'hired@example.test',
            'password' => 'Secret123!',
            'password_confirmation' => 'Secret123!',
            'locale' => 'en',
            'roles' => ['cashier'],
        ])->assertCreated();

        $hired = User::query()->where('email', 'hired@example.test')->firstOrFail();
        $this->assertSame($admin->id, $hired->created_by);

        // ...and so are visible to them straight away.
        $names = collect($this->actingAs($admin)->getJson('/api/v1/users')->json('data'))->pluck('name');
        $this->assertContains('Hired', $names);
    }

    public function test_a_company_admin_cannot_create_another_admin(): void
    {
        $tenant = Tenant::create(['name' => 'Kabul Mart']);
        $admin = $this->admin($tenant);

        // Creating an account they could then neither see nor manage, and
        // which sidesteps their own ceiling, is not theirs to do.
        $this->actingAs($admin)->postJson('/api/v1/users', [
            'name' => 'Second Owner',
            'email' => 'second@example.test',
            'password' => 'Secret123!',
            'password_confirmation' => 'Secret123!',
            'locale' => 'en',
            'roles' => ['admin'],
        ])->assertJsonValidationErrors('roles.0');

        $this->assertDatabaseMissing('users', ['email' => 'second@example.test']);
    }

    public function test_the_roles_endpoint_offers_only_what_the_actor_may_assign(): void
    {
        $tenant = Tenant::create(['name' => 'Kabul Mart']);
        $admin = $this->admin($tenant);

        $roles = collect($this->actingAs($admin)->getJson('/api/v1/roles')->assertOk()->json())
            ->pluck('name');

        // Offering a role the save would reject is how "superadmin" ended
        // up in a Company Admin's dropdown.
        $this->assertNotContains('superadmin', $roles);
        $this->assertNotContains('admin', $roles);
        $this->assertContains('manager', $roles);
        $this->assertContains('cashier', $roles);
    }

    public function test_the_permission_screen_offers_only_assignable_presets(): void
    {
        $tenant = Tenant::create(['name' => 'Kabul Mart']);
        $admin = $this->admin($tenant);

        $presets = array_keys($this->actingAs($admin)->getJson('/api/v1/permissions')->assertOk()->json('presets'));

        $this->assertNotContains('admin', $presets);
        $this->assertEqualsCanonicalizing(['manager', 'cashier'], $presets);
    }

    public function test_the_platform_owner_still_sees_and_assigns_everything(): void
    {
        $superadmin = User::factory()->create();
        $superadmin->assignRole('superadmin');

        $tenant = Tenant::create(['name' => 'Kabul Mart']);
        $admin = $this->admin($tenant);
        $this->staffOf($admin, 'Somebody');

        $names = collect($this->actingAs($superadmin)->getJson('/api/v1/users')->assertOk()->json('data'))
            ->pluck('name');
        // The business owner, yes; the person that owner hired, no.
        $this->assertContains($admin->name, $names);
        $this->assertNotContains('Somebody', $names);

        $roles = collect($this->actingAs($superadmin)->getJson('/api/v1/roles')->json())->pluck('name');
        $this->assertContains('superadmin', $roles);
        $this->assertContains('admin', $roles);
    }

    /**
     * The platform owner keeps the businesses, not their staff. Listing
     * every cashier of every shop turns that screen into an unreadable
     * directory and puts the platform owner in the middle of decisions that
     * belong to the shop.
     */
    public function test_the_platform_owner_sees_the_businesses_not_their_staff(): void
    {
        $superadmin = User::factory()->create();
        $superadmin->assignRole('superadmin');

        $tenant = Tenant::create(['name' => 'Kabul Mart']);
        $admin = $this->admin($tenant);
        $this->staffOf($admin, 'Their Cashier');

        $names = collect($this->actingAs($superadmin)->getJson('/api/v1/users')->assertOk()->json('data'))
            ->pluck('name');

        // The business owner is theirs to manage; the person that owner
        // hired is not.
        $this->assertContains($admin->name, $names);
        $this->assertNotContains('Their Cashier', $names);
    }

    public function test_the_platform_owner_still_sees_staff_they_provisioned_themselves(): void
    {
        $superadmin = User::factory()->create();
        $superadmin->assignRole('superadmin');

        $tenant = Tenant::create(['name' => 'Kabul Mart']);

        $this->actingAs($superadmin)->postJson('/api/v1/users', [
            'name' => 'Placed By Platform',
            'email' => 'placed@example.test',
            'password' => 'Secret123!',
            'password_confirmation' => 'Secret123!',
            'locale' => 'en',
            'roles' => ['cashier'],
            'tenant_id' => $tenant->id,
        ])->assertCreated();

        $names = collect($this->actingAs($superadmin)->getJson('/api/v1/users')->json('data'))->pluck('name');

        $this->assertContains('Placed By Platform', $names);
    }

    public function test_a_new_business_starts_on_the_standard_five_staff_allowance(): void
    {
        $superadmin = User::factory()->create();
        $superadmin->assignRole('superadmin');

        $this->actingAs($superadmin)->postJson('/api/v1/users', [
            'name' => 'Fresh Business',
            'email' => 'owner@fresh.test',
            'password' => 'Secret123!',
            'password_confirmation' => 'Secret123!',
            'locale' => 'en',
            'roles' => ['admin'],
        ])->assertCreated();

        $tenant = Tenant::query()->where('name', 'Fresh Business')->firstOrFail();
        $this->assertSame(Tenant::DEFAULT_MAX_USERS, $tenant->max_users);
        $this->assertSame(5, $tenant->max_users);

        // The owner's own account does not eat into the allowance.
        $this->assertSame(0, $tenant->staffCount());
        $this->assertSame(5, $tenant->remainingUserSlots());
    }

    public function test_the_admins_own_account_never_counts_against_the_staff_limit(): void
    {
        $tenant = Tenant::create(['name' => 'Small Shop', 'max_users' => 5]);
        $admin = $this->admin($tenant);

        foreach (range(1, 5) as $index) {
            $this->actingAs($admin)->postJson('/api/v1/users', [
                'name' => "Staff {$index}",
                'email' => "staff{$index}@example.test",
                'password' => 'Secret123!',
                'password_confirmation' => 'Secret123!',
                'locale' => 'en',
                'roles' => ['cashier'],
            ])->assertCreated();
        }

        // Five staff plus the admin: six logins, allowance spent.
        $this->assertSame(5, $tenant->fresh()->staffCount());
        $this->assertSame(6, $tenant->fresh()->userCount());

        $this->actingAs($admin)->postJson('/api/v1/users', [
            'name' => 'Sixth',
            'email' => 'sixth@example.test',
            'password' => 'Secret123!',
            'password_confirmation' => 'Secret123!',
            'locale' => 'en',
            'roles' => ['cashier'],
        ])->assertJsonValidationErrors('limit');
    }

    public function test_anyone_can_maintain_their_own_details_without_the_users_module(): void
    {
        $tenant = Tenant::create(['name' => 'Kabul Mart']);
        $cashier = User::factory()->create(['tenant_id' => $tenant->id, 'name' => 'Old Name']);
        $this->grantRole($cashier, 'cashier');

        // No users.* permission at all, yet their own account is theirs.
        $this->assertFalse($cashier->can('users.edit'));

        $this->actingAs($cashier)->post('/api/v1/auth/profile', [
            'name' => 'New Name',
            'email' => $cashier->email,
            'phone' => '0700000000',
        ])->assertOk()->assertJsonPath('data.name', 'New Name');

        $this->assertSame('New Name', $cashier->fresh()->name);
        $this->assertSame('0700000000', $cashier->fresh()->phone);
    }

    public function test_the_profile_endpoint_cannot_be_used_to_grant_yourself_anything(): void
    {
        $tenant = Tenant::create(['name' => 'Kabul Mart']);
        $cashier = User::factory()->create(['tenant_id' => $tenant->id, 'is_active' => true]);
        $this->grantRole($cashier, 'cashier');

        $otherTenant = Tenant::create(['name' => 'Elsewhere']);

        $this->actingAs($cashier)->post('/api/v1/auth/profile', [
            'name' => 'Still A Cashier',
            'email' => $cashier->email,
            'roles' => ['admin'],
            'permissions' => ['users.create'],
            'tenant_id' => $otherTenant->id,
            'is_active' => false,
        ])->assertOk();

        $fresh = $cashier->fresh();
        $this->assertFalse($fresh->can('users.create'));
        $this->assertTrue($fresh->hasRole('cashier'));
        $this->assertFalse($fresh->hasRole('admin'));
        $this->assertSame($tenant->id, $fresh->tenant_id);
        $this->assertTrue($fresh->is_active);
    }
}
