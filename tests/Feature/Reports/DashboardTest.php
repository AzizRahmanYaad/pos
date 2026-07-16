<?php

namespace Tests\Feature\Reports;

use App\Domain\Inventory\Actions\RecordStockMovementAction;
use App\Domain\Sales\Actions\CreateSaleAction;
use App\Models\CashAccount;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\BusinessSettingsSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RolesAndPermissionsSeeder::class, BusinessSettingsSeeder::class]);
    }

    public function test_dashboard_summary_reports_today_sales_and_profit(): void
    {
        $warehouse = Warehouse::factory()->create();
        $cashAccount = CashAccount::factory()->create();
        $cashier = User::factory()->create();

        $product = Product::factory()->create(['sale_price' => 25, 'reorder_level' => 100]);
        app(RecordStockMovementAction::class)->execute($product, $warehouse, StockMovement::TYPE_OPENING, 50, 10);

        app(CreateSaleAction::class)->execute(
            data: ['warehouse_id' => $warehouse->id],
            items: [['product_id' => $product->id, 'quantity' => 4, 'unit_id' => $product->unit_id, 'unit_price' => 25]],
            payments: [['cash_account_id' => $cashAccount->id, 'method' => 'cash', 'amount' => 100]],
            cashierId: $cashier->id,
        );

        $manager = User::factory()->create();
        $manager->assignRole('manager');

        $response = $this->actingAs($manager)
            ->getJson('/api/v1/dashboard/summary')
            ->assertOk();

        $response->assertJson([
            'today_sales' => 100.0,
            'today_sales_count' => 1,
            'today_profit' => 60.0,
            'low_stock_count' => 1,
        ]);
        $response->assertJsonCount(1, 'top_products');
        $response->assertJsonCount(1, 'recent_sales');
    }
}
