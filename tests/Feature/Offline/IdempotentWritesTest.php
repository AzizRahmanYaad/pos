<?php

namespace Tests\Feature\Offline;

use App\Http\Middleware\EnsureIdempotentWrites;
use App\Models\CashAccount;
use App\Models\Customer;
use App\Models\IdempotencyKey;
use App\Models\Product;
use App\Models\Sale;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * A till that sold while offline replays those sales when it reconnects,
 * and it cannot know whether the first attempt landed — a response lost on
 * a dying connection is indistinguishable from a request that never
 * arrived. So it sends the same key twice, and must get the same sale.
 */
class IdempotentWritesTest extends TestCase
{
    use RefreshDatabase;

    private User $cashier;

    private Warehouse $warehouse;

    private CashAccount $cashAccount;

    private Unit $unit;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $tenant = Tenant::create(['name' => 'Kabul Mart']);
        $this->cashier = User::factory()->create(['tenant_id' => $tenant->id]);
        $this->cashier->assignRole('admin');
        $this->cashier->refresh();

        $this->actingAs($this->cashier);
        $this->warehouse = Warehouse::create(['name' => 'Main', 'is_default' => true]);
        $this->cashAccount = CashAccount::create(['name' => 'Till', 'type' => CashAccount::TYPE_CASH, 'opening_balance' => 10000]);
        $this->unit = Unit::create(['name' => 'Piece', 'short_name' => 'pc', 'conversion_factor' => 1]);
    }

    private function stockedProduct(): Product
    {
        $product = Product::create([
            'name' => 'Rice 5kg', 'sku' => 'R5', 'unit_id' => $this->unit->id,
            'sale_price' => 100, 'default_cost' => 60, 'reorder_level' => 1,
            'type' => Product::TYPE_STANDARD, 'pricing_mode' => Product::PRICING_FIXED,
            'track_inventory' => true, 'is_active' => true,
        ]);

        $this->postJson('/api/v1/stock-adjustments', [
            'product_id' => $product->id, 'warehouse_id' => $this->warehouse->id,
            'quantity' => 100, 'unit_cost' => 60, 'reason' => 'Opening stock',
        ])->assertCreated();

        return $product;
    }

    /** @return array<string, mixed> */
    private function salePayload(Product $product): array
    {
        return [
            'warehouse_id' => $this->warehouse->id,
            'items' => [[
                'product_id' => $product->id, 'quantity' => 2,
                'unit_id' => $this->unit->id, 'unit_price' => 100,
            ]],
            'payments' => [[
                'cash_account_id' => $this->cashAccount->id,
                'method' => 'cash', 'amount' => 200,
            ]],
        ];
    }

    private function sell(Product $product, string $key)
    {
        return $this->withHeader(EnsureIdempotentWrites::HEADER, $key)
            ->postJson('/api/v1/sales', $this->salePayload($product));
    }

    public function test_replaying_a_sale_does_not_ring_it_up_twice(): void
    {
        $product = $this->stockedProduct();
        $key = (string) Str::uuid();

        $first = $this->sell($product, $key)->assertCreated();
        $second = $this->sell($product, $key)->assertCreated();

        $this->assertSame(1, Sale::query()->count());
        // The device gets back the same sale, so its receipt and its local
        // record still agree with the server.
        $this->assertSame($first->json('data.id'), $second->json('data.id'));
        $this->assertSame($first->json('data.invoice_number'), $second->json('data.invoice_number'));
        $second->assertHeader('Idempotent-Replay', 'true');
    }

    public function test_a_replayed_sale_does_not_take_the_stock_twice(): void
    {
        $product = $this->stockedProduct();
        $key = (string) Str::uuid();

        $this->sell($product, $key)->assertCreated();
        $stockAfterFirst = $product->stocks()->where('warehouse_id', $this->warehouse->id)->value('quantity');

        $this->sell($product, $key)->assertCreated();
        $stockAfterReplay = $product->stocks()->where('warehouse_id', $this->warehouse->id)->value('quantity');

        $this->assertSame($stockAfterFirst, $stockAfterReplay);
        $this->assertEquals(98, (float) $stockAfterReplay);
    }

    public function test_a_replayed_sale_does_not_take_the_money_twice(): void
    {
        $product = $this->stockedProduct();
        $key = (string) Str::uuid();

        $this->sell($product, $key)->assertCreated();
        $balanceAfterFirst = $this->cashAccount->fresh()->currentBalance();

        $this->sell($product, $key)->assertCreated();

        $this->assertEqualsWithDelta($balanceAfterFirst, $this->cashAccount->fresh()->currentBalance(), 0.001);
    }

    public function test_two_different_sales_are_two_sales(): void
    {
        $product = $this->stockedProduct();

        $this->sell($product, (string) Str::uuid())->assertCreated();
        $this->sell($product, (string) Str::uuid())->assertCreated();

        $this->assertSame(2, Sale::query()->count());
    }

    /**
     * Reusing a key for different content is a client bug. Returning the
     * first answer would quietly discard the second change.
     */
    public function test_the_same_key_with_different_content_is_refused(): void
    {
        $product = $this->stockedProduct();
        $key = (string) Str::uuid();

        $this->sell($product, $key)->assertCreated();

        $altered = $this->salePayload($product);
        $altered['items'][0]['quantity'] = 5;
        $altered['payments'][0]['amount'] = 500;

        $this->withHeader(EnsureIdempotentWrites::HEADER, $key)
            ->postJson('/api/v1/sales', $altered)
            ->assertStatus(422);

        $this->assertSame(1, Sale::query()->count());
    }

    public function test_one_devices_key_is_never_another_accounts_answer(): void
    {
        $product = $this->stockedProduct();
        $key = (string) Str::uuid();
        $this->sell($product, $key)->assertCreated();

        $other = User::factory()->create(['tenant_id' => $this->cashier->tenant_id]);
        $other->assignRole('admin');

        $this->actingAs($other->refresh())
            ->withHeader(EnsureIdempotentWrites::HEADER, $key)
            ->postJson('/api/v1/sales', $this->salePayload($product))
            ->assertStatus(409);
    }

    /**
     * A rejected write must stay rejected on retry — the device may be
     * sending a corrected version under the same key.
     */
    public function test_a_failed_write_is_not_remembered(): void
    {
        $key = (string) Str::uuid();

        $this->withHeader(EnsureIdempotentWrites::HEADER, $key)
            ->postJson('/api/v1/customers', ['name' => ''])
            ->assertStatus(422);

        $this->assertDatabaseCount('idempotency_keys', 0);

        // The same key now works for the corrected request.
        $this->withHeader(EnsureIdempotentWrites::HEADER, $key)
            ->postJson('/api/v1/customers', ['name' => 'Ahmad'])
            ->assertCreated();

        $this->assertSame(1, Customer::query()->count());
    }

    public function test_a_key_left_mid_flight_does_not_let_the_work_happen_twice(): void
    {
        $product = $this->stockedProduct();
        $key = (string) Str::uuid();

        // A first attempt that claimed the key and then died — the process
        // was killed, the connection dropped mid-transaction. Same request,
        // so the device is genuinely retrying rather than sending new work.
        IdempotencyKey::create([
            'key' => $key,
            'user_id' => $this->cashier->id,
            'tenant_id' => $this->cashier->tenant_id,
            'method' => 'POST',
            'path' => 'api/v1/sales',
            'request_fingerprint' => hash('sha256', implode('|', [
                'POST', 'api/v1/sales', json_encode($this->salePayload($product)),
            ])),
        ]);

        $this->sell($product, $key)->assertStatus(409);
        $this->assertSame(0, Sale::query()->count());
    }

    /**
     * The device drains its queue on a timer, so it has to know which
     * refusals will clear on their own. "Already being processed" will;
     * "you have no stock" never will, and retrying it every half minute
     * would keep a refused sale cycling quietly instead of putting it in
     * front of the person who made it.
     */
    public function test_a_refusal_worth_retrying_says_so_and_a_final_one_does_not(): void
    {
        $product = $this->stockedProduct();
        $key = (string) Str::uuid();

        IdempotencyKey::create([
            'key' => $key,
            'user_id' => $this->cashier->id,
            'tenant_id' => $this->cashier->tenant_id,
            'method' => 'POST',
            'path' => 'api/v1/sales',
            'request_fingerprint' => hash('sha256', implode('|', [
                'POST', 'api/v1/sales', json_encode($this->salePayload($product)),
            ])),
        ]);

        $this->sell($product, $key)
            ->assertStatus(409)
            ->assertHeader(EnsureIdempotentWrites::PENDING_HEADER, 'true');

        // Selling stock that is not there is a 409 as well, and no amount of
        // retrying will make it one — so it must not carry the marker.
        $bare = Product::create([
            'name' => 'Tea 1kg', 'sku' => 'T1', 'unit_id' => $this->unit->id,
            'sale_price' => 100, 'default_cost' => 60, 'reorder_level' => 1,
            'type' => Product::TYPE_STANDARD, 'pricing_mode' => Product::PRICING_FIXED,
            'track_inventory' => true, 'is_active' => true,
        ]);

        $response = $this->withHeader(EnsureIdempotentWrites::HEADER, (string) Str::uuid())
            ->postJson('/api/v1/sales', $this->salePayload($bare));

        $response->assertStatus(409);
        $this->assertNull($response->headers->get(EnsureIdempotentWrites::PENDING_HEADER));
    }

    /**
     * A till reconnecting after a long outage sends everything it has at
     * once and trips the rate limit part way through. The refusal it gets
     * back has to be one the device can tell apart from a real rejection,
     * or paid-for sales end up needing a person instead of another minute.
     */
    public function test_draining_a_long_queue_is_throttled_rather_than_rejected(): void
    {
        $product = $this->stockedProduct();

        $throttled = null;

        // The API limit is per minute, per user; well past it is the point.
        for ($i = 0; $i < 130; $i++) {
            $response = $this->withHeader(EnsureIdempotentWrites::HEADER, (string) Str::uuid())
                ->postJson('/api/v1/customers', ['name' => 'Ahmad '.$i]);

            if ($response->getStatusCode() === 429) {
                $throttled = $response;
                break;
            }
        }

        $this->assertNotNull($throttled, 'the API never throttled, so the queue could never trip it');

        // 429 and nothing else: a device that reads this as a rejection
        // would file a real sale away as a conflict.
        $throttled->assertStatus(429);
        $this->assertNotNull($throttled->headers->get('Retry-After'));
    }

    public function test_requests_without_a_key_are_untouched(): void
    {
        $product = $this->stockedProduct();

        $this->postJson('/api/v1/sales', $this->salePayload($product))->assertCreated();
        $this->postJson('/api/v1/sales', $this->salePayload($product))->assertCreated();

        // No key, no memory — the online application behaves exactly as before.
        $this->assertSame(2, Sale::query()->count());
        $this->assertDatabaseCount('idempotency_keys', 0);
    }

    public function test_a_malformed_key_is_rejected_rather_than_trusted(): void
    {
        $this->withHeader(EnsureIdempotentWrites::HEADER, 'not-a-uuid')
            ->postJson('/api/v1/customers', ['name' => 'Ahmad'])
            ->assertStatus(400);

        $this->assertSame(0, Customer::query()->count());
    }

    public function test_old_keys_are_forgotten(): void
    {
        $product = $this->stockedProduct();
        // Only the sale carried a key; the stock adjustment above did not.
        $this->sell($product, (string) Str::uuid())->assertCreated();

        $this->assertDatabaseCount('idempotency_keys', 1);

        IdempotencyKey::query()->update(['created_at' => now()->subDays(60)]);
        $this->artisan('idempotency:prune')->assertSuccessful();

        $this->assertDatabaseCount('idempotency_keys', 0);
    }
}
