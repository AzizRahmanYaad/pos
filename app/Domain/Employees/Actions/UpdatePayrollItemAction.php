<?php

namespace App\Domain\Employees\Actions;

use App\Domain\Employees\Exceptions\PayrollAlreadyProcessedException;
use App\Models\PayrollItem;
use App\Models\PayrollRun;

class UpdatePayrollItemAction
{
    public function execute(PayrollItem $item, float $bonuses, float $otherDeductions): PayrollItem
    {
        if ($item->payrollRun->status !== PayrollRun::STATUS_DRAFT) {
            throw new PayrollAlreadyProcessedException('This payroll run has already been paid.');
        }

        $netPay = round(
            (float) $item->base_salary + $bonuses - (float) $item->advances_deducted - $otherDeductions,
            2,
        );

        $item->update([
            'bonuses' => $bonuses,
            'other_deductions' => $otherDeductions,
            'net_pay' => max(0, $netPay),
        ]);

        return $item;
    }
}
