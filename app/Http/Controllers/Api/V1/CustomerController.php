<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Parties\StoreCustomerRequest;
use App\Http\Requests\Parties\UpdateCustomerRequest;
use App\Http\Resources\CustomerResource;
use App\Http\Resources\LedgerEntryResource;
use App\Models\Customer;
use Illuminate\Http\Response;

class CustomerController extends Controller
{
    public function index()
    {
        $this->authorize('viewAny', Customer::class);

        return CustomerResource::collection(Customer::query()->orderBy('name')->paginate(request()->integer('per_page', 20)));
    }

    public function store(StoreCustomerRequest $request): CustomerResource
    {
        return new CustomerResource(Customer::create($request->validated()));
    }

    public function show(Customer $customer): CustomerResource
    {
        $this->authorize('viewAny', Customer::class);

        return new CustomerResource($customer);
    }

    public function update(UpdateCustomerRequest $request, Customer $customer): CustomerResource
    {
        $customer->update($request->validated());

        return new CustomerResource($customer);
    }

    public function destroy(Customer $customer): Response
    {
        $this->authorize('delete', $customer);

        $customer->delete();

        return response()->noContent();
    }

    public function ledger(Customer $customer)
    {
        $this->authorize('viewAny', Customer::class);

        $entries = $customer->ledgerEntries()
            ->with('creator')
            ->orderByDesc('transaction_date')
            ->orderByDesc('id')
            ->paginate(request()->integer('per_page', 25));

        return LedgerEntryResource::collection($entries)->additional([
            'current_balance' => $customer->currentBalance(),
        ]);
    }
}
