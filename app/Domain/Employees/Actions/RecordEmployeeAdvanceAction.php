<?php

namespace App\Domain\Employees\Actions;

use App\Domain\Ledger\Actions\PostLedgerEntryAction;
use App\Models\CashAccount;
use App\Models\Employee;
use App\Models\EmployeeAdvance;
use App\Models\LedgerEntry;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class RecordEmployeeAdvanceAction
{
    public function __construct(
        private readonly PostLedgerEntryAction $postLedgerEntry,
    ) {}

    /**
     * Give an employee a salary advance: debit them (they now owe it back,
     * to be recovered from a future payroll run) and credit the cash
     * account it was paid from.
     */
    public function execute(
        Employee $employee,
        float $amount,
        CashAccount $cashAccount,
        ?string $reason,
        int $createdBy,
        ?Carbon $advanceDate = null,
    ): EmployeeAdvance {
        return DB::transaction(function () use ($employee, $amount, $cashAccount, $reason, $createdBy, $advanceDate) {
            $advance = EmployeeAdvance::create([
                'employee_id' => $employee->id,
                'cash_account_id' => $cashAccount->id,
                'amount' => $amount,
                'advance_date' => $advanceDate ?? now(),
                'reason' => $reason,
                'created_by' => $createdBy,
            ]);

            $this->postLedgerEntry->execute(
                ledgerable: $employee,
                entryType: LedgerEntry::DEBIT,
                amount: $amount,
                source: $advance,
                description: $reason ?? 'Salary advance',
                transactionDate: $advance->advance_date,
                createdBy: $createdBy,
            );

            $this->postLedgerEntry->execute(
                ledgerable: $cashAccount,
                entryType: LedgerEntry::CREDIT,
                amount: $amount,
                source: $advance,
                description: "Advance to {$employee->name}",
                transactionDate: $advance->advance_date,
                createdBy: $createdBy,
            );

            return $advance;
        });
    }
}
