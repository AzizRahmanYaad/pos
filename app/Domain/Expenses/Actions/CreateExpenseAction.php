<?php

namespace App\Domain\Expenses\Actions;

use App\Domain\Expenses\Exceptions\InvalidExpenseException;
use App\Domain\Ledger\Actions\PostLedgerEntryAction;
use App\Domain\PeriodClosing\Services\PeriodGuard;
use App\Models\CashAccount;
use App\Models\Expense;
use App\Models\LedgerEntry;
use App\Models\Purchase;
use App\Models\PurchaseLandedCost;
use Illuminate\Support\Facades\DB;

class CreateExpenseAction
{
    public function __construct(
        private readonly PostLedgerEntryAction $postLedgerEntry,
        private readonly PeriodGuard $periodGuard,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function execute(array $data, int $createdBy): Expense
    {
        $this->periodGuard->assertMutable($data['expense_date'] ?? now());

        return DB::transaction(function () use ($data, $createdBy) {
            $purchase = null;

            if (! empty($data['is_landed_cost']) && ! empty($data['purchase_id'])) {
                $purchase = Purchase::findOrFail($data['purchase_id']);

                if ($purchase->status !== Purchase::STATUS_DRAFT) {
                    throw new InvalidExpenseException(
                        "Purchase {$purchase->purchase_number} has already been {$purchase->status} — ".
                        'landed costs can only be attached before receiving.'
                    );
                }
            }

            $expense = Expense::create([
                'expense_category_id' => $data['expense_category_id'],
                'warehouse_id' => $data['warehouse_id'] ?? null,
                'cash_account_id' => $data['cash_account_id'],
                'amount' => $data['amount'],
                'expense_date' => $data['expense_date'] ?? now(),
                'paid_to' => $data['paid_to'] ?? null,
                'description' => $data['description'] ?? null,
                'is_landed_cost' => $data['is_landed_cost'] ?? false,
                'purchase_id' => $purchase?->id,
                'created_by' => $createdBy,
            ]);

            if ($purchase) {
                PurchaseLandedCost::create([
                    'purchase_id' => $purchase->id,
                    'expense_id' => $expense->id,
                    'description' => $expense->description ?? $expense->category->name,
                    'amount' => $expense->amount,
                    'allocation_method' => PurchaseLandedCost::METHOD_BY_VALUE,
                ]);

                $purchase->update([
                    'landed_cost_total' => (float) $purchase->landedCosts()->sum('amount'),
                ]);
            }

            $this->postLedgerEntry->execute(
                ledgerable: CashAccount::findOrFail($data['cash_account_id']),
                entryType: LedgerEntry::CREDIT,
                amount: (float) $data['amount'],
                source: $expense,
                description: $expense->description ?? 'Expense',
                transactionDate: $expense->expense_date,
                createdBy: $createdBy,
            );

            return $expense->load(['category', 'cashAccount', 'purchase']);
        });
    }
}
