<?php

namespace Tests\Feature\Settings;

use App\Http\Resources\BusinessSettingResource;
use App\Models\BusinessSetting;
use App\Models\Tenant;
use App\Models\User;
use App\Support\TenantContext;
use App\Support\TenantProvisioner;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Changing the company name on the Settings screen sends the whole settings
 * object back, because that is what the form holds. So whatever the screen
 * is given, it must be able to hand back — a field the server will not
 * accept is a field that stops the shopkeeper saving anything at all, with
 * an error naming half a dozen things they never touched.
 */
class BusinessSettingsCanAlwaysBeSavedTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    private function companyAdmin(): User
    {
        $tenant = Tenant::create(['name' => 'Kabul Mart']);

        $admin = User::factory()->create(['tenant_id' => $tenant->id]);
        $admin->assignRole('admin');

        return $admin->refresh();
    }

    /** What the screen does: read it, change two fields, send it all back. */
    private function saveWhatTheScreenHolds(User $admin, array $changes): TestResponse
    {
        $current = $this->actingAs($admin)->getJson('/api/v1/settings')->assertSuccessful()->json('data');

        return $this->actingAs($admin)->putJson('/api/v1/settings', array_merge($current, $changes));
    }

    public function test_a_company_admin_can_change_the_company_name_and_email(): void
    {
        $admin = $this->companyAdmin();
        app(TenantProvisioner::class)->provision($admin->tenant);

        $this->saveWhatTheScreenHolds($admin, [
            'company_name' => 'Kabul Mart Ltd',
            'email' => 'shop@kabulmart.test',
        ])
            ->assertOk()
            ->assertJsonPath('data.company_name', 'Kabul Mart Ltd')
            ->assertJsonPath('data.email', 'shop@kabulmart.test');
    }

    /**
     * The row a plain read creates is a whole row. It used to be inserted
     * with nothing but its tenant, and the copy handed straight back to the
     * screen held null for every column the database had defaulted.
     */
    public function test_a_settings_row_created_by_reading_it_comes_back_complete(): void
    {
        $admin = $this->companyAdmin();

        $settings = TenantContext::run($admin->tenant_id, fn () => BusinessSetting::current());

        foreach (array_keys(BusinessSetting::defaults()) as $field) {
            $this->assertNotNull($settings->{$field}, "{$field} came back null from a newly created row");
        }

        $this->saveWhatTheScreenHolds($admin, ['company_name' => 'Named At Last'])
            ->assertOk()
            ->assertJsonPath('data.company_name', 'Named At Last');
    }

    /**
     * The safety net under all of it: whatever state a settings record is
     * in — a row not yet written, a copy an older version of this
     * application left on a device — what the screen is handed is never a
     * null it cannot send back.
     */
    public function test_a_blank_record_is_still_presented_as_something_saveable(): void
    {
        $blank = new BusinessSetting;

        $presented = (new BusinessSettingResource($blank))->toArray(request());

        foreach (BusinessSetting::defaults() as $field => $default) {
            $this->assertNotNull($presented[$field], "{$field} was presented as null");
        }

        $this->assertSame('AFN', $presented['currency_code']);
        $this->assertSame('INV-', $presented['invoice_prefix']);
        $this->assertFalse($presented['auto_close_daily']);

        // The optional ones are genuinely optional, and stay empty.
        $this->assertNull($presented['address']);
        $this->assertNull($presented['email']);
    }

    /** Reading the settings is not permission to rewrite them. */
    public function test_staff_without_the_permission_still_cannot_save(): void
    {
        $admin = $this->companyAdmin();
        app(TenantProvisioner::class)->provision($admin->tenant);

        $cashier = User::factory()->create(['tenant_id' => $admin->tenant_id, 'created_by' => $admin->id]);
        $this->grantRole($cashier, 'cashier');

        $this->actingAs($cashier->refresh())
            ->putJson('/api/v1/settings', ['company_name' => 'Mine Now'])
            ->assertForbidden();
    }
}
