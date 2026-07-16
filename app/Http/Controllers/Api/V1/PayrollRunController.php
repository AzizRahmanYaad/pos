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

        return PayrollRunResource::collection(
            PayrollRun::query()->with('items.employee')->orderByDesc('period_year')->orderByDesc('period_month')->get()
        );
    }

    public function store(StorePayrollRunRequest $request, CreatePayrollRunAction $createRun): PayrollRunResource
    {
        $run = $createRun->execute(
            periodMonth: $request->validated('period_month'),
            periodYear: $request->validated('period_year'),
            generatedBy: $request->user()->id,
        );

        return new PayrollRunResource($run);
    }

    public function show(PayrollRun $payrollRun): PayrollRunResource
    {
        $this->authorize('viewAny', PayrollRun::class);

        return new PayrollRunResource($payrollRun->load('items.employee'));
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
