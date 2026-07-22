<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Parties\StoreCustomerRequest;
use App\Http\Requests\Parties\UpdateCustomerRequest;
use App\Http\Resources\CustomerResource;
use App\Http\Resources\LedgerEntryResource;
use App\Models\Customer;
use App\Support\LedgerStatementPdf;
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

    /**
     * Aggregate customer balances: how much customers owe the shop
     * (receivable) versus how much the shop owes customers back in
     * advances/credit — embedded as a stat header on the customers list.
     */
    public function summary()
    {
        $this->authorize('viewAny', Customer::class);

        $balances = Customer::query()->get()->map(fn (Customer $customer) => (float) $customer->currentBalance());

        return response()->json([
            'data' => [
                'receivable' => round($balances->filter(fn ($b) => $b > 0)->sum(), 2),
                'advance' => round($balances->filter(fn ($b) => $b < 0)->sum(fn ($b) => -$b), 2),
            ],
        ]);
    }

    public function listPdf(\App\Support\ListReportPdf $pdf)
    {
        $this->authorize('viewAny', Customer::class);

        $customers = Customer::query()
            ->when(request('search'), function ($query, $search) {
                $query->where(function ($query) use ($search) {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%");
                });
            })
            ->orderBy('name')
            ->get();

        $sym = \App\Models\BusinessSetting::current()->currency_symbol ?: '';
        $money = fn ($v) => number_format((float) $v, 2).($sym ? ' '.$sym : '');

        $columns = [
            ['label' => __('Name'), 'width' => '30%'],
            ['label' => __('Phone'), 'width' => '20%'],
            ['label' => __('Address'), 'width' => '28%'],
            ['label' => __('Balance'), 'align' => 'right', 'width' => '22%'],
        ];

        $rows = $customers->map(fn ($c) => [
            $c->name,
            $c->phone ?: '—',
            $c->address ?: '—',
            $money($c->currentBalance()),
        ])->all();

        return response($pdf->build(__('Customers'), $columns, $rows, __('Customer directory')), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="customers-'.now()->format('Ymd').'.pdf"',
        ]);
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
     * Download the customer's ledger as a professional PDF statement,
     * honouring the same search / date-range / archived filters as the
     * on-screen ledger. Entries are laid out chronologically so the
     * running balance reads naturally top to bottom.
     */
    public function ledgerPdf(Customer $customer, LedgerStatementPdf $pdf)
    {
        $this->authorize('viewAny', Customer::class);

        $entries = $customer->ledgerEntries()
            ->with('creator')
            ->when(! request()->boolean('include_archived'), fn ($query) => $query->whereNull('archived_at'))
            ->when(request('search'), fn ($query, $search) => $query->where('description', 'like', "%{$search}%"))
            ->when(request('from'), fn ($query, $from) => $query->whereDate('transaction_date', '>=', $from))
            ->when(request('to'), fn ($query, $to) => $query->whereDate('transaction_date', '<=', $to))
            ->orderBy('transaction_date')
            ->orderBy('id')
            ->get();

        $filename = 'statement-'.\Illuminate\Support\Str::slug($customer->name).'-'.now()->format('Ymd').'.pdf';

        return response($pdf->build($customer, $entries, 'customer'), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
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
