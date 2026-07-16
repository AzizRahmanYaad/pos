<?php

namespace App\Domain\Employees\Actions;

use App\Domain\Employees\Exceptions\PayrollAlreadyProcessedException;
use App\Domain\Ledger\Actions\PostLedgerEntryAction;
use App\Models\CashAccount;
use App\Models\LedgerEntry;
use App\Models\PayrollRun;
use Illuminate\Support\Facades\DB;

class PayPayrollRunAction
{
    public function __construct(
        private readonly PostLedgerEntryAction $postLedgerEntry,
    ) {}

    /**
     * Disburse a draft payroll run: credit the employee for any advances
     * recovered this cycle (reducing what they owe) and pay out net_pay
     * in cash per employee.
     */
    public function execute(PayrollRun $payrollRun, CashAccount $cashAccount, int $paidBy): PayrollRun
    {
        return DB::transaction(function () use ($payrollRun, $cashAccount, $paidBy) {
            $locked = PayrollRun::query()->whereKey($payrollRun->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== PayrollRun::STATUS_DRAFT) {
                throw new PayrollAlreadyProcessedException('This payroll run has already been paid.');
            }

            $items = $payrollRun->items()->with('employee')->get();

            foreach ($items as $item) {
                if ((float) $item->advances_deducted > 0) {
                    $this->postLedgerEntry->execute(
                        ledgerable: $item->employee,
                        entryType: LedgerEntry::CREDIT,
                        amount: (float) $item->advances_deducted,
                        source: $item,
                        description: "Advance recovered — payroll {$payrollRun->period_month}/{$payrollRun->period_year}",
                        createdBy: $paidBy,
                    );
                }

                if ((float) $item->net_pay > 0) {
                    $this->postLedgerEntry->execute(
                        ledgerable: $cashAccount,
                        entryType: LedgerEntry::CREDIT,
                        amount: (float) $item->net_pay,
                        source: $item,
                        description: "Salary — {$item->employee->name}",
                        createdBy: $paidBy,
                    );
                }
            }

            $locked->update(['status' => PayrollRun::STATUS_PAID, 'paid_at' => now()]);

            return $payrollRun->fresh(['items.employee']);
        });
    }
}
