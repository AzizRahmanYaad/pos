<?php

namespace Tests\Feature\Activity;

use App\Models\Activity;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Permissions;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The activity log is the one table that would read across every business
 * at once if nobody stopped it. Who can open it, and how far it reaches,
 * follows exactly the same rules as the Users screen.
 */
class ActivityLogAccessTest extends TestCase
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

    /** An entry as if this user had done something, without going through a screen. */
    private function entryFor(User $user, string $module = 'products', string $event = 'created'): Activity
    {
        return Activity::withoutGlobalScopes()->create([
            'tenant_id' => $user->tenant_id,
            'log_name' => $module,
            'description' => $event,
            'event' => $event,
            'causer_type' => User::class,
            'causer_id' => $user->id,
        ]);
    }

    public function test_one_business_never_sees_another_businesss_history(): void
    {
        $mine = Tenant::create(['name' => 'Mine']);
        $theirs = Tenant::create(['name' => 'Theirs']);

        $admin = $this->admin($mine);
        $outsider = $this->admin($theirs);

        $this->entryFor($admin, 'sales');
        $this->entryFor($outsider, 'purchases');

        $modules = collect($this->actingAs($admin)->getJson('/api/v1/activity-log')->assertOk()->json('data'))
            ->pluck('module');

        $this->assertContains('sales', $modules);
        $this->assertNotContains('purchases', $modules);
    }

    public function test_an_admin_sees_their_own_staffs_history_but_not_another_admins(): void
    {
        $tenant = Tenant::create(['name' => 'Shared Shop']);
        $first = $this->admin($tenant);
        $second = $this->admin($tenant);

        $mine = User::factory()->create(['tenant_id' => $tenant->id, 'name' => 'My Cashier', 'created_by' => $first->id]);
        $theirs = User::factory()->create(['tenant_id' => $tenant->id, 'name' => 'Their Cashier', 'created_by' => $second->id]);

        $this->entryFor($first);
        $this->entryFor($mine);
        $this->entryFor($second);
        $this->entryFor($theirs);

        $names = collect($this->actingAs($first)->getJson('/api/v1/activity-log')->assertOk()->json('data'))
            ->pluck('user_name');

        $this->assertEqualsCanonicalizing([$first->name, 'My Cashier'], $names->unique()->all());
    }

    public function test_the_platform_owner_sees_every_businesss_history(): void
    {
        $superadmin = User::factory()->create();
        $superadmin->assignRole('superadmin');

        $first = $this->admin(Tenant::create(['name' => 'One']));
        $second = $this->admin(Tenant::create(['name' => 'Two']));

        $this->entryFor($first, 'sales');
        $this->entryFor($second, 'purchases');

        $modules = collect($this->actingAs($superadmin)->getJson('/api/v1/activity-log')->assertOk()->json('data'))
            ->pluck('module');

        $this->assertContains('sales', $modules);
        $this->assertContains('purchases', $modules);
    }

    public function test_staff_without_the_permission_cannot_open_the_log_at_all(): void
    {
        $tenant = Tenant::create(['name' => 'Kabul Mart']);
        $cashier = User::factory()->create(['tenant_id' => $tenant->id]);
        $this->grantRole($cashier, 'cashier');

        // Straight at the URL, not just hidden in the menu.
        $this->actingAs($cashier)->getJson('/api/v1/activity-log')->assertForbidden();
        $this->actingAs($cashier)->getJson('/api/v1/activity-log/filters')->assertForbidden();
        $this->actingAs($cashier)->get('/api/v1/activity-log/export')->assertForbidden();
    }

    public function test_viewing_the_log_does_not_carry_the_right_to_take_it_away(): void
    {
        $tenant = Tenant::create(['name' => 'Kabul Mart']);
        $manager = User::factory()->create(['tenant_id' => $tenant->id]);
        $this->grantRole($manager, 'manager');
        $manager->givePermissionTo('activity.view');

        $this->actingAs($manager->refresh())->getJson('/api/v1/activity-log')->assertOk();
        $this->actingAs($manager->refresh())->get('/api/v1/activity-log/export')->assertForbidden();
    }

    public function test_the_filters_offer_only_people_whose_entries_are_visible(): void
    {
        $tenant = Tenant::create(['name' => 'Shared Shop']);
        $first = $this->admin($tenant);
        $second = $this->admin($tenant);

        $this->entryFor($first);
        $this->entryFor($second);

        $names = collect($this->actingAs($first)->getJson('/api/v1/activity-log/filters')->assertOk()->json('users'))
            ->pluck('name');

        // Offering a name whose entries cannot be read is a leak of its own.
        $this->assertSame([$first->name], $names->all());
    }

    public function test_the_log_can_be_narrowed_by_person_module_and_action(): void
    {
        $tenant = Tenant::create(['name' => 'Kabul Mart']);
        $admin = $this->admin($tenant);
        $cashier = User::factory()->create(['tenant_id' => $tenant->id, 'created_by' => $admin->id]);

        $this->entryFor($admin, 'sales', 'created');
        $this->entryFor($admin, 'products', 'deleted');
        $this->entryFor($cashier, 'sales', 'created');

        $byUser = $this->actingAs($admin)->getJson("/api/v1/activity-log?user_id={$cashier->id}")->json('data');
        $this->assertCount(1, $byUser);
        $this->assertSame($cashier->name, $byUser[0]['user_name']);

        $byModule = $this->actingAs($admin)->getJson('/api/v1/activity-log?module=products')->json('data');
        $this->assertCount(1, $byModule);
        $this->assertSame('products', $byModule[0]['module']);

        $byEvent = $this->actingAs($admin)->getJson('/api/v1/activity-log?event=created')->json('data');
        $this->assertCount(2, $byEvent);
    }

    public function test_the_newest_action_is_the_first_thing_you_see(): void
    {
        $tenant = Tenant::create(['name' => 'Kabul Mart']);
        $admin = $this->admin($tenant);

        $this->entryFor($admin, 'sales', 'created');
        $this->entryFor($admin, 'products', 'deleted');

        $data = $this->actingAs($admin)->getJson('/api/v1/activity-log')->assertOk()->json('data');

        $this->assertSame('products', $data[0]['module']);
    }

    public function test_the_export_returns_the_same_rows_as_a_spreadsheet(): void
    {
        $tenant = Tenant::create(['name' => 'Kabul Mart']);
        $admin = $this->admin($tenant);
        $this->entryFor($admin, 'sales', 'created');

        $response = $this->actingAs($admin)->get('/api/v1/activity-log/export')->assertOk();
        $csv = $response->streamedContent();

        $this->assertStringContainsString('When,User,Module,Action', $csv);
        $this->assertStringContainsString($admin->name, $csv);
        $this->assertStringContainsString('sales', $csv);
    }

    public function test_reading_the_log_is_a_permission_a_company_admin_can_hand_out(): void
    {
        // It sits in the company's own matrix, not the platform owner's.
        $this->assertContains('activity.view', Permissions::forCompany());
        $this->assertContains('activity.export', Permissions::forCompany());
    }
}
