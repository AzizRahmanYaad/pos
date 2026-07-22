<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Parties\StoreSupplierRequest;
use App\Http\Requests\Parties\UpdateSupplierRequest;
use App\Http\Resources\LedgerEntryResource;
use App\Http\Resources\SupplierResource;
use App\Models\Supplier;
use App\Support\LedgerStatementPdf;
use Illuminate\Http\Response;

class SupplierController extends Controller
{
    public function index()
    {
        $this->authorize('viewAny', Supplier::class);

        return SupplierResource::collection(
            Supplier::query()
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
     * Aggregate supplier balances: how much the shop owes suppliers
     * (payable) versus how much the shop is in credit with suppliers via
     * advances/prepayments — embedded as a stat header on the suppliers
     * list.
     */
    public function summary()
    {
        $this->authorize('viewAny', Supplier::class);

        $balances = Supplier::query()->get()->map(fn (Supplier $supplier) => (float) $supplier->currentBalance());

        return response()->json([
            'data' => [
                'payable' => round($balances->filter(fn ($b) => $b < 0)->sum(fn ($b) => -$b), 2),
                'advance' => round($balances->filter(fn ($b) => $b > 0)->sum(), 2),
            ],
        ]);
    }

    public function store(StoreSupplierRequest $request): SupplierResource
    {
        return new SupplierResource(Supplier::create($request->validated()));
    }

    public function show(Supplier $supplier): SupplierResource
    {
        $this->authorize('viewAny', Supplier::class);

        return new SupplierResource($supplier);
    }

    public function update(UpdateSupplierRequest $request, Supplier $supplier): SupplierResource
    {
        $supplier->update($request->validated());

        return new SupplierResource($supplier);
    }

    public function destroy(Supplier $supplier): Response
    {
        $this->authorize('delete', $supplier);

        $supplier->delete();

        return response()->noContent();
    }

    public function ledger(Supplier $supplier)
    {
        $this->authorize('viewAny', Supplier::class);

        $entries = $supplier->ledgerEntries()
            ->with('creator')
            ->when(! request()->boolean('include_archived'), fn ($query) => $query->whereNull('archived_at'))
            ->when(request('search'), fn ($query, $search) => $query->where('description', 'like', "%{$search}%"))
            ->when(request('from'), fn ($query, $from) => $query->whereDate('transaction_date', '>=', $from))
            ->when(request('to'), fn ($query, $to) => $query->whereDate('transaction_date', '<=', $to))
            ->orderByDesc('transaction_date')
            ->orderByDesc('id')
            ->paginate(request()->integer('per_page', 25));

        return LedgerEntryResource::collection($entries)->additional([
            'current_balance' => $supplier->currentBalance(),
        ]);
    }

    public function ledgerPdf(Supplier $supplier, LedgerStatementPdf $pdf)
    {
        $this->authorize('viewAny', Supplier::class);

        $entries = $supplier->ledgerEntries()
            ->with('creator')
            ->when(! request()->boolean('include_archived'), fn ($query) => $query->whereNull('archived_at'))
            ->when(request('search'), fn ($query, $search) => $query->where('description', 'like', "%{$search}%"))
            ->when(request('from'), fn ($query, $from) => $query->whereDate('transaction_date', '>=', $from))
            ->when(request('to'), fn ($query, $to) => $query->whereDate('transaction_date', '<=', $to))
            ->orderBy('transaction_date')
            ->orderBy('id')
            ->get();

        $filename = 'statement-'.\Illuminate\Support\Str::slug($supplier->name).'-'.now()->format('Ymd').'.pdf';

        return response($pdf->build($supplier, $entries, 'supplier'), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
        ]);
    }

    /**
     * Clear a fully-settled supplier ledger: archive every visible entry so
     * the ledger starts fresh. Nothing is deleted — the rows stay in the
     * database as cleared history and the action is written to the activity
     * log.
     */
    public function clearLedger(Supplier $supplier)
    {
        abort_unless(request()->user()->can('payments.manage'), 403);

        $balance = round($supplier->currentBalance(), 2);
        abort_if(
            $balance !== 0.0,
            422,
            __('The ledger can only be cleared when the balance is exactly zero.'),
        );

        $archived = $supplier->ledgerEntries()
            ->whereNull('archived_at')
            ->update(['archived_at' => now()]);

        activity()
            ->causedBy(request()->user())
            ->performedOn($supplier)
            ->withProperties(['entries_archived' => $archived, 'balance_at_clear' => $balance])
            ->log('Cleared supplier ledger');

        return response()->noContent();
    }
}
