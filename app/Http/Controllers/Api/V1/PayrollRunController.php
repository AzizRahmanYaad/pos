<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Employees\Actions\CreatePayrollRunAction;
use App\Domain\Employees\Actions\PayPayrollRunAction;
use App\Domain\Employees\Actions\UpdatePayrollItemAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Payroll\PayPayrollRunRequest;
use App\Http\Requests\Payroll\StorePayrollRunRequest;
use App\Http\Requests\Payroll\UpdatePayrollItemRequest;
use App\Http\Resources\PayrollItemResource;
use App\Http\Resources\PayrollRunResource;
use App\Models\CashAccount;
use App\Models\PayrollItem;
use App\Models\PayrollRun;

class PayrollRunController extends Controller
{
    public function index()
    {
        $this->authorize('viewAny', PayrollRun::class);

        $runs = PayrollRun::query()
            ->with(['employee', 'items.employee'])
            ->when(request('from'), fn ($query, $from) => $query->whereDate('period_date', '>=', $from))
            ->when(request('to'), fn ($query, $to) => $query->whereDate('period_date', '<=', $to))
            ->when(request('employee_id'), fn ($query, $employeeId) => $query->where('employee_id', $employeeId))
            ->orderByDesc('period_year')
            ->orderByDesc('period_month')
            ->orderByDesc('id')
            ->get();

        return PayrollRunResource::collection($runs);
    }

    public function store(StorePayrollRunRequest $request, CreatePayrollRunAction $createRun): PayrollRunResource
    {
        $employee = \App\Models\Employee::findOrFail($request->validated('employee_id'));
        $date = \Illuminate\Support\Carbon::parse($request->validated('date'));

        $run = $createRun->execute(
            periodMonth: (int) $date->month,
            periodYear: (int) $date->year,
            generatedBy: $request->user()->id,
            employeeId: $employee->id,
            periodDate: $date->toDateString(),
            bonuses: (float) ($request->validated('bonuses') ?? 0),
            otherDeductions: (float) ($request->validated('other_deductions') ?? 0),
        );

        return new PayrollRunResource($run);
    }

    public function show(PayrollRun $payrollRun): PayrollRunResource
    {
        $this->authorize('viewAny', PayrollRun::class);

        return new PayrollRunResource($payrollRun->load(['employee', 'items.employee']));
    }

    public function reportPdf(PayrollRun $payrollRun, \App\Support\PayrollReportPdf $pdf)
    {
        $this->authorize('viewAny', PayrollRun::class);

        $filename = 'payroll-'.$payrollRun->period_year.'-'.str_pad((string) $payrollRun->period_month, 2, '0', STR_PAD_LEFT).'.pdf';

        return response($pdf->build($payrollRun), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
        ]);
    }

    public function updateItem(
        UpdatePayrollItemRequest $request,
        PayrollItem $payrollItem,
        UpdatePayrollItemAction $updateItem,
    ): PayrollItemResource {
        $item = $updateItem->execute(
            item: $payrollItem,
            bonuses: (float) $request->validated('bonuses'),
            otherDeductions: (float) $request->validated('other_deductions'),
        );

        return new PayrollItemResource($item->load('employee'));
    }

    public function pay(PayPayrollRunRequest $request, PayrollRun $payrollRun, PayPayrollRunAction $payRun): PayrollRunResource
    {
        $run = $payRun->execute(
            payrollRun: $payrollRun,
            cashAccount: CashAccount::findOrFail($request->validated('cash_account_id')),
            paidBy: $request->user()->id,
        );

        return new PayrollRunResource($run);
    }
}
