<?php

namespace App\Domain\Employees\Actions;

use App\Domain\Employees\Exceptions\PayrollAlreadyProcessedException;
use App\Models\Employee;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use Illuminate\Support\Facades\DB;

class CreatePayrollRunAction
{
    /**
     * Generate a draft payroll run with one item per active employee.
     * Outstanding advances are auto-deducted only when they're fully
     * covered by that employee's base salary — a partial deduction would
     * require splitting a single advance row across two payroll runs,
     * which isn't supported; any advance too large for one run's salary
     * is left outstanding for a future run to pick up in full.
     */
    public function execute(
        int $periodMonth,
        int $periodYear,
        int $generatedBy,
        ?int $employeeId = null,
        ?string $periodDate = null,
    ): PayrollRun {
        if ($employeeId !== null) {
            $alreadyRun = PayrollRun::where('employee_id', $employeeId)
                ->where('period_month', $periodMonth)
                ->where('period_year', $periodYear)
                ->exists();

            if ($alreadyRun) {
                throw new PayrollAlreadyProcessedException(
                    "Payroll for this employee has already been run for {$periodMonth}/{$periodYear}."
                );
            }
        } elseif (PayrollRun::whereNull('employee_id')->where('period_month', $periodMonth)->where('period_year', $periodYear)->exists()) {
            throw new PayrollAlreadyProcessedException(
                "A payroll run for {$periodMonth}/{$periodYear} already exists."
            );
        }

        return DB::transaction(function () use ($periodMonth, $periodYear, $generatedBy, $employeeId, $periodDate) {
            $run = PayrollRun::create([
                'employee_id' => $employeeId,
                'period_month' => $periodMonth,
                'period_year' => $periodYear,
                'period_date' => $periodDate,
                'status' => PayrollRun::STATUS_DRAFT,
                'generated_by' => $generatedBy,
            ]);

            $employees = $employeeId !== null
                ? Employee::query()->whereKey($employeeId)->get()
                : Employee::query()->where('is_active', true)->get();

            foreach ($employees as $employee) {
                $outstandingAdvances = $employee->advances()->whereNull('deducted_in_payroll_item_id')->get();
                $outstandingTotal = (float) $outstandingAdvances->sum('amount');
                $baseSalary = (float) $employee->salary_amount;

                $advancesDeducted = $outstandingTotal > 0 && $outstandingTotal <= $baseSalary
                    ? $outstandingTotal
                    : 0.0;

                $netPay = round($baseSalary - $advancesDeducted, 2);

                $item = PayrollItem::create([
                    'payroll_run_id' => $run->id,
                    'employee_id' => $employee->id,
                    'base_salary' => $baseSalary,
                    'advances_deducted' => $advancesDeducted,
                    'other_deductions' => 0,
                    'bonuses' => 0,
                    'net_pay' => $netPay,
                ]);

                if ($advancesDeducted > 0) {
                    $outstandingAdvances->each(
                        fn ($advance) => $advance->update(['deducted_in_payroll_item_id' => $item->id])
                    );
                }
            }

            return $run->load(['employee', 'items.employee']);
        });
    }
}
