<?php

namespace Tests\Feature\Activity;

use App\Models\Activity;
use App\Models\CashAccount;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\ExpenseCategory;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * The guarantee, stated once and checked against the real routing table:
 * a user cannot change anything without the log naming them.
 *
 * Each case below drives a real endpoint and asserts that the entries it
 * produced are attributed to the account that made the call — not to null,
 * and not to somebody else.
 */
class EveryWriteIsTracedTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $actor;

    private Warehouse $warehouse;

    private CashAccount $cashAccount;

    private Unit $unit;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create(['name' => 'Kabul Mart']);
        $this->actor = User::factory()->create(['tenant_id' => $this->tenant->id, 'name' => 'The Actor']);
        $this->actor->assignRole('admin');
        $this->actor->refresh();

        // Acting first so the tenant scope stamps everything created below.
        $this->actingAs($this->actor);

        $this->warehouse = Warehouse::create(['name' => 'Main', 'is_default' => true]);
        $this->cashAccount = CashAccount::create(['name' => 'Till', 'type' => CashAccount::TYPE_CASH, 'opening_balance' => 100000]);
        $this->unit = Unit::create(['name' => 'Piece', 'short_name' => 'pc', 'conversion_factor' => 1]);
    }

    /**
     * Run one endpoint and hand back only the entries it produced.
     *
     * @return Collection<int, Activity>
     */
    private function trace(callable $action): Collection
    {
        $mark = (int) Activity::withoutGlobalScopes()->max('id');

        $action();

        return Activity::withoutGlobalScopes()->where('id', '>', $mark)->orderBy('id')->get()->collect();
    }

    /** Assert the endpoint left a trail, and that the trail names the actor. */
    private function assertTracedToActor(callable $action, string $expectedModule): void
    {
        $entries = $this->trace($action);

        $this->assertNotEmpty($entries, "Nothing at all was recorded for [{$expectedModule}].");

        $this->assertTrue(
            $entries->contains(fn (Activity $entry) => $entry->causer_id === $this->actor->id),
            "No entry for [{$expectedModule}] names the user who did it."
        );

        $this->assertTrue(
            $entries->contains(fn (Activity $entry) => $entry->log_name === $expectedModule),
            "Nothing was filed under [{$expectedModule}]; got [".$entries->pluck('log_name')->unique()->implode(', ').'].'
        );

        // Whatever else it recorded, it must all belong to this business.
        $entries->each(fn (Activity $entry) => $this->assertSame(
            $this->tenant->id,
            $entry->tenant_id,
            "An entry for [{$expectedModule}] landed outside the business."
        ));
    }

    private function product(string $sku = 'P1'): Product
    {
        return Product::create([
            'name' => "Product {$sku}",
            'sku' => $sku,
            'unit_id' => $this->unit->id,
            'sale_price' => 100,
            'default_cost' => 60,
            'reorder_level' => 1,
            'type' => Product::TYPE_STANDARD,
            'pricing_mode' => Product::PRICING_FIXED,
            'track_inventory' => true,
            'is_active' => true,
        ]);
    }

    private function stocked(string $sku = 'P1'): Product
    {
        $product = $this->product($sku);

        $this->postJson('/api/v1/stock-adjustments', [
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouse->id,
            'quantity' => 100,
            'unit_cost' => 60,
            'reason' => 'Opening stock',
        ])->assertCreated();

        return $product;
    }

    public function test_creating_editing_and_deleting_a_product_is_traced(): void
    {
        $product = null;

        $this->assertTracedToActor(function () use (&$product) {
            $product = $this->postJson('/api/v1/products', [
                'name' => 'Rice', 'sku' => 'R1', 'unit_id' => $this->unit->id,
                'sale_price' => 100, 'reorder_level' => 1, 'type' => 'standard',
                'pricing_mode' => 'fixed', 'track_inventory' => true, 'is_active' => true,
            ])->assertCreated()->json('data');
        }, 'products');

        $this->assertTracedToActor(function () use ($product) {
            $this->putJson("/api/v1/products/{$product['id']}", ['sale_price' => 120])->assertOk();
        }, 'products');

        $this->assertTracedToActor(function () use ($product) {
            $this->deleteJson("/api/v1/products/{$product['id']}")->assertNoContent();
        }, 'products');
    }

    public function test_creating_editing_and_deleting_a_customer_is_traced(): void
    {
        $customer = null;

        $this->assertTracedToActor(function () use (&$customer) {
            $customer = $this->postJson('/api/v1/customers', ['name' => 'Ahmad'])
                ->assertCreated()->json('data');
        }, 'customers');

        $this->assertTracedToActor(function () use ($customer) {
            $this->putJson("/api/v1/customers/{$customer['id']}", ['name' => 'Ahmad Khan'])->assertOk();
        }, 'customers');

        $this->assertTracedToActor(function () use ($customer) {
            $this->deleteJson("/api/v1/customers/{$customer['id']}")->assertNoContent();
        }, 'customers');
    }

    public function test_creating_editing_and_deleting_a_supplier_is_traced(): void
    {
        $supplier = null;

        $this->assertTracedToActor(function () use (&$supplier) {
            $supplier = $this->postJson('/api/v1/suppliers', ['name' => 'Wholesaler'])
                ->assertCreated()->json('data');
        }, 'suppliers');

        $this->assertTracedToActor(function () use ($supplier) {
            $this->putJson("/api/v1/suppliers/{$supplier['id']}", ['name' => 'Wholesaler Ltd'])->assertOk();
        }, 'suppliers');

        $this->assertTracedToActor(function () use ($supplier) {
            $this->deleteJson("/api/v1/suppliers/{$supplier['id']}")->assertNoContent();
        }, 'suppliers');
    }

    public function test_ringing_up_a_sale_is_traced(): void
    {
        $product = $this->stocked();

        $this->assertTracedToActor(function () use ($product) {
            $this->postJson('/api/v1/sales', [
                'warehouse_id' => $this->warehouse->id,
                'items' => [[
                    'product_id' => $product->id, 'quantity' => 2,
                    'unit_id' => $this->unit->id, 'unit_price' => 100,
                ]],
                'payments' => [[
                    'cash_account_id' => $this->cashAccount->id,
                    'method' => 'cash', 'amount' => 200,
                ]],
            ])->assertCreated();
        }, 'sales');
    }

    public function test_refunding_a_sale_is_traced(): void
    {
        $product = $this->stocked();
        $sale = $this->postJson('/api/v1/sales', [
            'warehouse_id' => $this->warehouse->id,
            'items' => [['product_id' => $product->id, 'quantity' => 2, 'unit_id' => $this->unit->id, 'unit_price' => 100]],
            'payments' => [['cash_account_id' => $this->cashAccount->id, 'method' => 'cash', 'amount' => 200]],
        ])->assertCreated()->json('data');

        $this->assertTracedToActor(function () use ($sale) {
            $this->postJson("/api/v1/sales/{$sale['id']}/refund")->assertOk();
        }, 'sales');
    }

    public function test_the_whole_purchase_lifecycle_is_traced(): void
    {
        $product = $this->product('PU1');
        $supplier = Supplier::create(['name' => 'Wholesaler']);
        $purchase = null;

        $this->assertTracedToActor(function () use (&$purchase, $product, $supplier) {
            $purchase = $this->postJson('/api/v1/purchases', [
                'supplier_id' => $supplier->id,
                'warehouse_id' => $this->warehouse->id,
                'purchase_date' => now()->toDateString(),
                'items' => [[
                    'product_id' => $product->id, 'quantity' => 10,
                    'unit_id' => $this->unit->id, 'unit_cost' => 60,
                ]],
            ])->assertCreated()->json('data');
        }, 'purchases');

        // Receiving is where cash actually leaves the till, so it is the one
        // step nobody should be able to take without their name on it.
        $this->assertTracedToActor(function () use ($purchase) {
            $this->postJson("/api/v1/purchases/{$purchase['id']}/receive", [
                'payment' => [
                    'amount' => 600,
                    'cash_account_id' => $this->cashAccount->id,
                    'method' => 'cash',
                ],
            ])->assertOk();
        }, 'purchases');
    }

    public function test_cancelling_a_purchase_is_traced(): void
    {
        $product = $this->product('PU2');
        $supplier = Supplier::create(['name' => 'Other Wholesaler']);

        $purchase = $this->postJson('/api/v1/purchases', [
            'supplier_id' => $supplier->id,
            'warehouse_id' => $this->warehouse->id,
            'purchase_date' => now()->toDateString(),
            'items' => [['product_id' => $product->id, 'quantity' => 5, 'unit_id' => $this->unit->id, 'unit_cost' => 60]],
        ])->assertCreated()->json('data');

        $this->assertTracedToActor(function () use ($purchase) {
            $this->postJson("/api/v1/purchases/{$purchase['id']}/cancel")->assertOk();
        }, 'purchases');
    }

    public function test_recording_a_payment_is_traced(): void
    {
        $customer = Customer::create(['name' => 'Ahmad']);

        $this->assertTracedToActor(function () use ($customer) {
            $this->postJson('/api/v1/payments', [
                'party_type' => 'customer', 'party_id' => $customer->id,
                'direction' => 'in', 'amount' => 500,
                'cash_account_id' => $this->cashAccount->id, 'method' => 'cash',
            ])->assertCreated();
        }, 'payments');
    }

    public function test_recording_and_deleting_an_expense_is_traced(): void
    {
        $category = ExpenseCategory::create(['name' => 'Rent']);
        $expense = null;

        $this->assertTracedToActor(function () use (&$expense, $category) {
            $expense = $this->postJson('/api/v1/expenses', [
                'expense_category_id' => $category->id,
                'cash_account_id' => $this->cashAccount->id,
                'amount' => 2000,
                'description' => 'Shop rent',
            ])->assertCreated()->json('data');
        }, 'expenses');

        $this->assertTracedToActor(function () use ($expense) {
            $this->deleteJson("/api/v1/expenses/{$expense['id']}")->assertNoContent();
        }, 'expenses');
    }

    public function test_employee_records_and_advances_are_traced(): void
    {
        $employee = null;

        $this->assertTracedToActor(function () use (&$employee) {
            $employee = $this->postJson('/api/v1/employees', [
                'name' => 'Sayed', 'salary_amount' => 10000, 'salary_type' => 'monthly',
            ])->assertCreated()->json('data');
        }, 'employees');

        $this->assertTracedToActor(function () use ($employee) {
            $this->putJson("/api/v1/employees/{$employee['id']}", ['salary_amount' => 12000])->assertOk();
        }, 'employees');

        $this->assertTracedToActor(function () use ($employee) {
            $this->postJson("/api/v1/employees/{$employee['id']}/advances", [
                'amount' => 1000,
                'cash_account_id' => $this->cashAccount->id,
                'reason' => 'Family emergency',
            ])->assertNoContent();
        }, 'employees');
    }

    public function test_running_and_paying_payroll_is_traced(): void
    {
        $employee = Employee::create([
            'name' => 'Sayed', 'salary_amount' => 10000, 'salary_type' => Employee::SALARY_MONTHLY, 'is_active' => true,
        ]);
        $run = null;

        $this->assertTracedToActor(function () use (&$run, $employee) {
            $run = $this->postJson('/api/v1/payroll-runs', [
                'employee_id' => $employee->id,
                'date' => now()->toDateString(),
            ])->assertCreated()->json('data');
        }, 'payroll');

        $this->assertTracedToActor(function () use ($run) {
            $this->postJson("/api/v1/payroll-runs/{$run['id']}/pay", [
                'cash_account_id' => $this->cashAccount->id,
            ])->assertOk();
        }, 'payroll');
    }

    public function test_adjusting_stock_is_traced(): void
    {
        $product = $this->product('ADJ');

        $this->assertTracedToActor(function () use ($product) {
            $this->postJson('/api/v1/stock-adjustments', [
                'product_id' => $product->id,
                'warehouse_id' => $this->warehouse->id,
                'quantity' => 25,
                'unit_cost' => 60,
                'reason' => 'Stock count correction',
            ])->assertCreated();
        }, 'inventory');
    }

    public function test_closing_and_reopening_a_period_is_traced(): void
    {
        $closing = null;

        $this->assertTracedToActor(function () use (&$closing) {
            $closing = $this->postJson('/api/v1/period-closings', [
                'period_type' => 'daily',
                'period_start' => now()->toDateString(),
                'period_end' => now()->toDateString(),
            ])->assertCreated()->json('data');
        }, 'period-closing');

        $this->assertTracedToActor(function () use ($closing) {
            $this->postJson("/api/v1/period-closings/{$closing['id']}/reopen")->assertOk();
        }, 'period-closing');
    }

    public function test_changing_business_settings_is_traced(): void
    {
        $this->assertTracedToActor(function () {
            $this->putJson('/api/v1/settings', ['company_name' => 'Kabul Mart Ltd'])->assertSuccessful();
        }, 'settings');
    }

    public function test_creating_editing_and_deleting_a_staff_account_is_traced(): void
    {
        $staff = null;

        $this->assertTracedToActor(function () use (&$staff) {
            $staff = $this->postJson('/api/v1/users', [
                'name' => 'New Cashier', 'email' => 'cashier@kabul.test',
                'password' => 'Secret123!', 'password_confirmation' => 'Secret123!',
                'locale' => 'en', 'roles' => ['cashier'],
            ])->assertCreated()->json('data');
        }, 'users');

        $this->assertTracedToActor(function () use ($staff) {
            $this->putJson("/api/v1/users/{$staff['id']}", ['name' => 'Renamed Cashier'])->assertOk();
        }, 'users');

        $this->assertTracedToActor(function () use ($staff) {
            $this->deleteJson("/api/v1/users/{$staff['id']}")->assertNoContent();
        }, 'users');
    }

    public function test_catalogue_and_setup_records_are_traced(): void
    {
        $cases = [
            ['products', fn () => $this->postJson('/api/v1/categories', ['name' => 'Grains'])],
            ['products', fn () => $this->postJson('/api/v1/units', ['name' => 'Kilo', 'short_name' => 'kg', 'conversion_factor' => 1])],
            ['inventory', fn () => $this->postJson('/api/v1/warehouses', ['name' => 'Backroom'])],
            ['ledger', fn () => $this->postJson('/api/v1/cash-accounts', ['name' => 'Bank', 'type' => 'bank', 'opening_balance' => 0])],
            ['expenses', fn () => $this->postJson('/api/v1/expense-categories', ['name' => 'Utilities'])],
        ];

        foreach ($cases as [$module, $call]) {
            $this->assertTracedToActor(fn () => $call()->assertCreated(), $module);
        }
    }

    public function test_clearing_a_party_ledger_is_traced(): void
    {
        $customer = Customer::create(['name' => 'Settled Up']);
        $supplier = Supplier::create(['name' => 'Settled Supplier']);

        $this->assertTracedToActor(function () use ($customer) {
            $this->postJson("/api/v1/customers/{$customer->id}/ledger/clear")->assertNoContent();
        }, 'customers');

        $this->assertTracedToActor(function () use ($supplier) {
            $this->postJson("/api/v1/suppliers/{$supplier->id}/ledger/clear")->assertNoContent();
        }, 'suppliers');
    }

    public function test_changing_your_own_account_is_traced(): void
    {
        $this->assertTracedToActor(function () {
            $this->post('/api/v1/auth/profile', [
                'name' => 'The Actor Renamed',
                'email' => $this->actor->email,
            ])->assertOk();
        }, 'users');

        $this->assertTracedToActor(function () {
            $this->putJson('/api/v1/auth/password', [
                'current_password' => 'password',
                'password' => 'NewSecret123!',
                'password_confirmation' => 'NewSecret123!',
            ])->assertSuccessful();
        }, 'account');
    }

    /**
     * The list above is only as good as its coverage. This walks the real
     * routing table and fails if a write endpoint appears that no case here
     * exercises — so a new one cannot be added without a decision about
     * whether it is traced.
     */
    public function test_no_write_endpoint_escapes_this_test(): void
    {
        $covered = [
            'api/v1/auth/login', 'api/v1/auth/logout', 'api/v1/auth/password', 'api/v1/auth/profile',
            'api/v1/cash-accounts', 'api/v1/cash-accounts/{cash_account}',
            'api/v1/categories', 'api/v1/categories/{category}',
            'api/v1/customers', 'api/v1/customers/{customer}', 'api/v1/customers/{customer}/ledger/clear',
            'api/v1/employees', 'api/v1/employees/{employee}', 'api/v1/employees/{employee}/advances',
            'api/v1/expense-categories', 'api/v1/expense-categories/{expense_category}',
            'api/v1/expenses', 'api/v1/expenses/{expense}',
            'api/v1/payments',
            'api/v1/payroll-items/{payrollItem}', 'api/v1/payroll-runs', 'api/v1/payroll-runs/{payrollRun}/pay',
            'api/v1/period-closings', 'api/v1/period-closings/{periodClosing}/reopen',
            'api/v1/products', 'api/v1/products/{product}',
            'api/v1/purchases', 'api/v1/purchases/{purchase}',
            'api/v1/purchases/{purchase}/cancel', 'api/v1/purchases/{purchase}/receive',
            'api/v1/sales', 'api/v1/sales/{sale}/refund',
            'api/v1/settings', 'api/v1/stock-adjustments',
            'api/v1/suppliers', 'api/v1/suppliers/{supplier}', 'api/v1/suppliers/{supplier}/ledger/clear',
            'api/v1/tenants/{tenant}',
            'api/v1/units', 'api/v1/units/{unit}',
            'api/v1/users', 'api/v1/users/{user}', 'api/v1/users/{user}/extend',
            'api/v1/warehouses', 'api/v1/warehouses/{warehouse}',
        ];

        $writeRoutes = collect(Route::getRoutes()->getRoutes())
            ->filter(fn ($route) => str_starts_with($route->uri(), 'api/'))
            ->filter(fn ($route) => array_intersect($route->methods(), ['POST', 'PUT', 'PATCH', 'DELETE']) !== [])
            ->map(fn ($route) => $route->uri())
            ->unique()
            ->values();

        $uncovered = $writeRoutes->diff($covered)->values();

        $this->assertEmpty(
            $uncovered->all(),
            'These write endpoints are not covered by a tracing test: '.$uncovered->implode(', ')
        );
    }
}
