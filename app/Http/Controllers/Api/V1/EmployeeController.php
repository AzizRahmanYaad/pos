<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Employees\Actions\RecordEmployeeAdvanceAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Employees\StoreEmployeeAdvanceRequest;
use App\Http\Requests\Employees\StoreEmployeeRequest;
use App\Http\Requests\Employees\UpdateEmployeeRequest;
use App\Http\Resources\EmployeeResource;
use App\Http\Resources\LedgerEntryResource;
use App\Models\CashAccount;
use App\Models\Employee;
use Illuminate\Http\Response;

class EmployeeController extends Controller
{
    public function index()
    {
        $this->authorize('viewAny', Employee::class);

        return EmployeeResource::collection(Employee::query()->orderBy('name')->get());
    }

    public function store(StoreEmployeeRequest $request): EmployeeResource
    {
        return new EmployeeResource(Employee::create($request->validated()));
    }

    public function show(Employee $employee): EmployeeResource
    {
        $this->authorize('viewAny', Employee::class);

        return new EmployeeResource($employee);
    }

    public function update(UpdateEmployeeRequest $request, Employee $employee): EmployeeResource
    {
        $employee->update($request->validated());

        return new EmployeeResource($employee);
    }

    public function destroy(Employee $employee): Response
    {
        $this->authorize('delete', $employee);

        $employee->delete();

        return response()->noContent();
    }

    public function ledger(Employee $employee)
    {
        $this->authorize('viewAny', Employee::class);

        $entries = $employee->ledgerEntries()
            ->with('creator')
            ->orderByDesc('transaction_date')
            ->orderByDesc('id')
            ->paginate(request()->integer('per_page', 25));

        return LedgerEntryResource::collection($entries)->additional([
            'current_balance' => $employee->currentBalance(),
        ]);
    }

    public function storeAdvance(
        StoreEmployeeAdvanceRequest $request,
        Employee $employee,
        RecordEmployeeAdvanceAction $recordAdvance,
    ): Response {
        $recordAdvance->execute(
            employee: $employee,
            amount: (float) $request->validated('amount'),
            cashAccount: CashAccount::findOrFail($request->validated('cash_account_id')),
            reason: $request->validated('reason'),
            createdBy: $request->user()->id,
        );

        return response()->noContent();
    }
}
