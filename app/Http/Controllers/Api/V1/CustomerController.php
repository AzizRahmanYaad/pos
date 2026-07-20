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

        return CustomerResource::collection(
            Customer::query()
                ->when(request('search'), function ($query, $search) {
                    $query->where(function ($query) use ($search) {
                        $query->where('name', 'like', "%{$search}%")
                            ->orWhere('phone', 'like', "%{$search}%");
                    });
                })
                ->orderBy('name')
                ->paginate(request()->integer('per_page', 20))
        );
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
            ->when(! request()->boolean('include_archived'), fn ($query) => $query->whereNull('archived_at'))
            ->when(request('search'), fn ($query, $search) => $query->where('description', 'like', "%{$search}%"))
            ->when(request('from'), fn ($query, $from) => $query->whereDate('transaction_date', '>=', $from))
            ->when(request('to'), fn ($query, $to) => $query->whereDate('transaction_date', '<=', $to))
            ->orderByDesc('transaction_date')
            ->orderByDesc('id')
            ->paginate(request()->integer('per_page', 25));

        return LedgerEntryResource::collection($entries)->additional([
            'current_balance' => $customer->currentBalance(),
        ]);
    }

    /**
     * Clear a fully-settled ledger: archive every visible entry so the
     * ledger starts fresh. Nothing is deleted — the rows stay in the
     * database as cleared history and the action itself is written to
     * the activity log.
     */
    public function clearLedger(Customer $customer)
    {
        abort_unless(request()->user()->can('payments.manage'), 403);

        $balance = round($customer->currentBalance(), 2);
        abort_if(
            $balance !== 0.0,
            422,
            __('The ledger can only be cleared when the balance is exactly zero.'),
        );

        $archived = $customer->ledgerEntries()
            ->whereNull('archived_at')
            ->update(['archived_at' => now()]);

        activity()
            ->causedBy(request()->user())
            ->performedOn($customer)
            ->withProperties(['entries_archived' => $archived, 'balance_at_clear' => $balance])
            ->log('Cleared customer ledger');

        return response()->noContent();
    }
}
