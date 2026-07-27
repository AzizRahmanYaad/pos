<?php

namespace Tests\Feature\Settings;

use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\BusinessSettingsSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Your own name, photo and password are yours whatever else you may do in
 * the application. Staff hired by a Company Admin hold no settings
 * permission, and for a while that hid the entire Settings screen from
 * them — including the half of it that was never about the business.
 */
class EveryoneReachesTheirOwnAccountTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RolesAndPermissionsSeeder::class, BusinessSettingsSeeder::class]);
    }

    private function staff(): User
    {
        $tenant = Tenant::create(['name' => 'Kabul Mart']);
        $admin = User::factory()->create(['tenant_id' => $tenant->id]);
        $admin->assignRole('admin');

        $cashier = User::factory()->create(['tenant_id' => $tenant->id, 'created_by' => $admin->id]);
        $this->grantRole($cashier, 'cashier');

        return $cashier->refresh();
    }

    public function test_a_cashier_holds_no_settings_permission_at_all(): void
    {
        $cashier = $this->staff();

        // The premise of everything below.
        $this->assertFalse($cashier->can('settings.view'));
        $this->assertFalse($cashier->can('settings.edit'));
    }

    public function test_they_can_still_change_their_own_details(): void
    {
        $cashier = $this->staff();

        $this->actingAs($cashier)->post('/api/v1/auth/profile', [
            'name' => 'Renamed Themselves',
            'email' => $cashier->email,
            'phone' => '0700123456',
        ])->assertOk()->assertJsonPath('data.name', 'Renamed Themselves');

        $this->assertSame('0700123456', $cashier->fresh()->phone);
    }

    public function test_they_can_still_change_their_own_password(): void
    {
        $cashier = $this->staff();

        $this->actingAs($cashier)->putJson('/api/v1/auth/password', [
            'current_password' => 'password',
            'password' => 'BrandNew123!',
            'password_confirmation' => 'BrandNew123!',
        ])->assertSuccessful();
    }

    /**
     * What they may not do is change the business itself.
     *
     * Reading it is a different matter and stays open on purpose: the
     * company name in the header, the currency on every price and the
     * footer on every receipt come from here, so an account that could not
     * read it could not render the application at all. settings.view
     * decides whether the form is put in front of somebody, not whether
     * the shop's own name is a secret from the people working there.
     */
    public function test_they_cannot_change_the_business_settings(): void
    {
        $cashier = $this->staff();

        $this->actingAs($cashier)
            ->putJson('/api/v1/settings', ['company_name' => 'Hijacked'])
            ->assertForbidden();

        $this->assertDatabaseMissing('business_settings', ['company_name' => 'Hijacked']);

        // Still able to read what the app needs to draw itself.
        $this->actingAs($cashier)->getJson('/api/v1/settings')->assertSuccessful();
    }

    /**
     * The screen is only reachable because the route and the sidebar stop
     * demanding a permission for it. If either grows one back, staff lose
     * their account screen again and nothing else would notice.
     */
    public function test_the_settings_screen_is_not_gated_behind_a_permission(): void
    {
        $routes = file_get_contents(base_path('resources/js/app/routes.tsx'));
        $navigation = file_get_contents(base_path('resources/js/app/navigation.tsx'));

        $this->assertMatchesRegularExpression(
            "/\{ path: 'settings', element: <SettingsPage \/> \}/",
            $routes,
            'The Settings route is guarded again; staff can no longer reach their own account.'
        );

        $this->assertStringNotContainsString(
            "'/settings', 'nav.settings', <SettingsOutlinedIcon />, '",
            $navigation,
            'The Settings sidebar link requires a permission again; staff can no longer find their own account.'
        );
    }
}
