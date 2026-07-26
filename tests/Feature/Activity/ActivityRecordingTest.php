<?php

namespace Tests\Feature\Activity;

use App\Models\Activity;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Whatever a user does, the log knows about it: what changed, who changed
 * it, and where from.
 */
class ActivityRecordingTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create(['name' => 'Kabul Mart']);
        $this->admin = User::factory()->create(['tenant_id' => $this->tenant->id, 'name' => 'Owner']);
        $this->admin->assignRole('admin');
    }

    private function entries(): Collection
    {
        return Activity::withoutGlobalScopes()->orderBy('id')->get();
    }

    private function createProduct(array $overrides = []): array
    {
        $unit = Unit::create(['tenant_id' => $this->tenant->id, 'name' => 'Piece', 'short_name' => 'pc']);

        $response = $this->actingAs($this->admin)->postJson('/api/v1/products', array_merge([
            'name' => 'Rice 5kg',
            'sku' => 'R5',
            'unit_id' => $unit->id,
            'sale_price' => 100,
            'reorder_level' => 5,
            'type' => 'standard',
            'pricing_mode' => 'fixed',
            'track_inventory' => true,
            'is_active' => true,
        ], $overrides))->assertCreated();

        return $response->json('data');
    }

    public function test_creating_a_record_is_logged_with_who_what_and_where(): void
    {
        $this->createProduct();

        $entry = $this->entries()->last();

        $this->assertSame('products', $entry->log_name);
        $this->assertSame('created', $entry->event);
        $this->assertSame($this->admin->id, $entry->causer_id);
        $this->assertSame($this->tenant->id, $entry->tenant_id);
        $this->assertSame('Rice 5kg', $entry->properties->get('subject_label'));
        $this->assertSame('127.0.0.1', $entry->ip_address);
        $this->assertSame('Rice 5kg', $entry->attribute_changes->get('attributes')['name']);
    }

    public function test_an_edit_records_the_value_before_and_after(): void
    {
        $product = $this->createProduct();

        $this->actingAs($this->admin)
            ->putJson("/api/v1/products/{$product['id']}", ['sale_price' => 150])
            ->assertOk();

        $entry = $this->entries()->last();

        $this->assertSame('updated', $entry->event);
        // Only what actually moved, so the log stays readable.
        $this->assertSame(['sale_price' => '150.00'], $entry->attribute_changes->get('attributes'));
        $this->assertSame(['sale_price' => '100.00'], $entry->attribute_changes->get('old'));
    }

    public function test_a_deletion_keeps_the_name_the_record_had(): void
    {
        $product = $this->createProduct();

        $this->actingAs($this->admin)->deleteJson("/api/v1/products/{$product['id']}")->assertNoContent();

        $entry = $this->entries()->last();

        $this->assertSame('deleted', $entry->event);
        // The row is gone; the log still says what it was called.
        $this->assertSame('Rice 5kg', $entry->properties->get('subject_label'));
        $this->assertDatabaseMissing('products', ['id' => $product['id']]);
    }

    public function test_saving_a_form_without_changing_anything_records_no_field_changes(): void
    {
        $product = $this->createProduct();

        $this->actingAs($this->admin)
            ->putJson("/api/v1/products/{$product['id']}", ['sale_price' => 100])
            ->assertOk();

        // The press of Save is still traced, but there is no invented
        // before/after for a value that never moved.
        $entry = $this->entries()->last();
        $this->assertSame('updated', $entry->event);
        $this->assertNull($entry->attribute_changes?->get('attributes'));
    }

    public function test_signing_in_and_out_is_recorded(): void
    {
        $this->withHeader('Referer', config('app.url'))->postJson('/api/v1/auth/login', [
            'email' => $this->admin->email,
            'password' => 'password',
        ])->assertOk();

        $signIn = $this->entries()->last();
        $this->assertSame('account', $signIn->log_name);
        $this->assertSame('signed-in', $signIn->event);
        $this->assertSame($this->admin->id, $signIn->causer_id);
        $this->assertSame($this->tenant->id, $signIn->tenant_id);

        $this->actingAs($this->admin)->postJson('/api/v1/auth/logout')->assertNoContent();

        $this->assertSame('signed-out', $this->entries()->last()->event);
    }

    /**
     * Laravel auto-discovers listeners in app/Listeners whose methods are
     * named handle*, which once registered these a second time on top of
     * the explicit bindings — every sign-in appeared twice in the log.
     */
    public function test_one_sign_in_is_one_entry(): void
    {
        $this->withHeader('Referer', config('app.url'))->postJson('/api/v1/auth/login', [
            'email' => $this->admin->email,
            'password' => 'password',
        ])->assertOk();

        $this->assertCount(1, $this->entries()->where('event', 'signed-in'));
    }

    public function test_a_failed_sign_in_is_recorded_against_the_account_that_was_tried(): void
    {
        $this->withHeader('Referer', config('app.url'))->postJson('/api/v1/auth/login', [
            'email' => $this->admin->email,
            'password' => 'wrong-password',
        ])->assertStatus(422);

        $entry = $this->entries()->last();

        $this->assertSame('sign-in-failed', $entry->event);
        $this->assertSame($this->admin->id, $entry->causer_id);
        $this->assertSame($this->admin->email, $entry->properties->get('email'));
    }

    /**
     * Somebody reaching for a screen they cannot open is usually the app
     * itself asking for data the user lacks — noise. Somebody trying to
     * *change* what is not theirs is not noise, and is recorded.
     */
    public function test_being_refused_a_change_is_recorded(): void
    {
        $cashier = User::factory()->create(['tenant_id' => $this->tenant->id, 'created_by' => $this->admin->id]);
        $this->grantRole($cashier, 'cashier');

        $this->actingAs($cashier)->postJson('/api/v1/users', [
            'name' => 'Sneaky', 'email' => 'sneaky@example.test',
            'password' => 'Secret123!', 'password_confirmation' => 'Secret123!',
            'locale' => 'en', 'roles' => ['cashier'],
        ])->assertForbidden();

        $entry = $this->entries()->last();

        $this->assertSame('denied', $entry->event);
        $this->assertSame($cashier->id, $entry->causer_id);
        $this->assertSame('users', $entry->log_name);
        $this->assertSame(403, $entry->properties->get('status'));
    }

    /**
     * The screen a user cannot open is already hidden from their menu; the
     * app still asks for some of that data on shared screens, and every one
     * of those refusals used to become a red row the owner had to scroll
     * past. Reads are not recorded, refused or otherwise.
     */
    public function test_being_refused_a_read_is_not_recorded(): void
    {
        $cashier = User::factory()->create(['tenant_id' => $this->tenant->id, 'created_by' => $this->admin->id]);
        $this->grantRole($cashier, 'cashier');

        $before = $this->entries()->count();

        $this->actingAs($cashier)->getJson('/api/v1/users')->assertForbidden();
        $this->actingAs($cashier)->getJson('/api/v1/employees')->assertForbidden();
        $this->actingAs($cashier)->getJson('/api/v1/reports/sales-summary')->assertForbidden();

        $this->assertSame($before, $this->entries()->count());
    }

    public function test_taking_data_out_of_the_system_is_recorded(): void
    {
        $this->actingAs($this->admin)->get('/api/v1/products/report/pdf')->assertOk();

        $entry = $this->entries()->last();

        $this->assertSame('exported', $entry->event);
        $this->assertSame('products', $entry->log_name);
        $this->assertSame($this->admin->id, $entry->causer_id);
    }

    /**
     * Reading is not an event. Every list, dashboard tile and balance poll
     * would otherwise fill the log until nobody could read through it.
     */
    public function test_simply_looking_at_a_screen_records_nothing(): void
    {
        $before = $this->entries()->count();

        $this->actingAs($this->admin)->getJson('/api/v1/products')->assertOk();
        $this->actingAs($this->admin)->getJson('/api/v1/customers')->assertOk();

        $this->assertSame($before, $this->entries()->count());
    }

    /**
     * An endpoint that changes something without saving a logged model still
     * has to leave a trace — otherwise the log quietly has holes in it.
     */
    public function test_an_action_that_saves_no_logged_model_is_still_recorded(): void
    {
        // Acting first so the tenant scope stamps the customer: tenant_id is
        // not mass-assignable, it is taken from whoever is signed in.
        $this->actingAs($this->admin);
        $customer = Customer::create(['name' => 'Walk-in']);
        $before = $this->entries()->count();

        $this->actingAs($this->admin)
            ->postJson("/api/v1/customers/{$customer->id}/ledger/clear")
            ->assertNoContent();

        $this->assertGreaterThan($before, $this->entries()->count());
    }

    public function test_a_products_worth_of_child_rows_does_not_flood_the_log(): void
    {
        $this->createProduct();
        $this->createProduct(['name' => 'Oil 1L', 'sku' => 'O1']);

        // Two products and their two units — not a row per stock record.
        $productEntries = $this->entries()->where('log_name', 'products');

        $this->assertCount(4, $productEntries);
    }

    public function test_logging_never_breaks_the_action_itself(): void
    {
        // A subject with no label attributes at all still logs, and the
        // request still succeeds.
        $unit = Unit::create(['tenant_id' => $this->tenant->id, 'name' => 'Box', 'short_name' => 'bx']);

        $product = Product::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Nameless',
            'sku' => 'N1',
            'unit_id' => $unit->id,
            'sale_price' => 1,
            'reorder_level' => 0,
            'type' => 'standard',
            'pricing_mode' => 'fixed',
        ]);

        $this->assertSame('Nameless', $this->entries()->last()->properties->get('subject_label'));
        $this->assertTrue($product->exists);
    }
}
