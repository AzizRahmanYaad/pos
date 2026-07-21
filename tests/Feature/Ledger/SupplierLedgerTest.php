<?php

namespace Tests\Feature\Ledger;

use App\Domain\Ledger\Actions\PostLedgerEntryAction;
use App\Models\LedgerEntry;
use App\Models\Supplier;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SupplierLedgerTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        return $admin;
    }

    public function test_supplier_ledger_pdf_downloads_and_respects_filters(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $supplier = Supplier::create(['name' => 'Kabul Wholesale', 'phone' => '0788000000']);
        $action = app(PostLedgerEntryAction::class);
        // Purchased on credit (we owe more), then paid part of it.
        $action->execute($supplier, LedgerEntry::CREDIT, 800, description: 'Purchase PO-1');
        $action->execute($supplier, LedgerEntry::DEBIT, 300, description: 'Payment');

        $admin = $this->admin();

        $response = $this->actingAs($admin)->get("/api/v1/suppliers/{$supplier->id}/ledger/pdf");
        $response->assertOk();
        $response->assertHeader('content-type', 'application/pdf');
        $this->assertStringStartsWith('%PDF-', $response->getContent());

        // Search filter narrows results.
        $this->actingAs($admin)
            ->getJson("/api/v1/suppliers/{$supplier->id}/ledger?search=PO-1")
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_supplier_ledger_clear_requires_zero_balance_and_logs(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $supplier = Supplier::create(['name' => 'Kabul Wholesale']);
        $action = app(PostLedgerEntryAction::class);
        $action->execute($supplier, LedgerEntry::CREDIT, 500, description: 'Purchase');

        $admin = $this->admin();

        // Still owing → blocked.
        $this->actingAs($admin)
            ->postJson("/api/v1/suppliers/{$supplier->id}/ledger/clear")
            ->assertUnprocessable();

        // Settle it, then clear.
        $action->execute($supplier, LedgerEntry::DEBIT, 500, description: 'Payment');

        $this->actingAs($admin)
            ->postJson("/api/v1/suppliers/{$supplier->id}/ledger/clear")
            ->assertNoContent();

        $this->actingAs($admin)
            ->getJson("/api/v1/suppliers/{$supplier->id}/ledger")
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->assertDatabaseHas('activity_log', [
            'description' => 'Cleared supplier ledger',
            'causer_id' => $admin->id,
        ]);
    }
}
