<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Parties\StoreCashAccountRequest;
use App\Http\Requests\Parties\UpdateCashAccountRequest;
use App\Http\Resources\CashAccountResource;
use App\Http\Resources\LedgerEntryResource;
use App\Models\CashAccount;
use App\Support\LedgerStatementPdf;
use Illuminate\Http\Response;

class CashAccountController extends Controller
{
    public function index()
    {
        $this->authorize('viewAny', CashAccount::class);

        return CashAccountResource::collection(CashAccount::query()->orderBy('name')->get());
    }

    public function store(StoreCashAccountRequest $request): CashAccountResource
    {
        return new CashAccountResource(CashAccount::create($request->validated()));
    }

    public function show(CashAccount $cashAccount): CashAccountResource
    {
        $this->authorize('viewAny', CashAccount::class);

        return new CashAccountResource($cashAccount);
    }

    public function update(UpdateCashAccountRequest $request, CashAccount $cashAccount): CashAccountResource
    {
        $cashAccount->update($request->validated());

        return new CashAccountResource($cashAccount);
    }

    public function destroy(CashAccount $cashAccount): Response
    {
        $this->authorize('delete', $cashAccount);

        $cashAccount->delete();

        return response()->noContent();
    }

    /**
     * The cash account's transaction history — every deposit (debit) and
     * withdrawal (credit) with a running balance, the same statement
     * pattern used for customer/supplier ledgers.
     */
    public function ledger(CashAccount $cashAccount)
    {
        $this->authorize('viewAny', CashAccount::class);

        $entries = $cashAccount->ledgerEntries()
            ->with('creator')
            ->when(request('search'), fn ($query, $search) => $query->where('description', 'like', "%{$search}%"))
            ->when(request('from'), fn ($query, $from) => $query->whereDate('transaction_date', '>=', $from))
            ->when(request('to'), fn ($query, $to) => $query->whereDate('transaction_date', '<=', $to))
            ->orderByDesc('transaction_date')
            ->orderByDesc('id')
            ->paginate(request()->integer('per_page', 25));

        return LedgerEntryResource::collection($entries)->additional([
            'current_balance' => $cashAccount->currentBalance(),
        ]);
    }

    public function ledgerPdf(CashAccount $cashAccount, LedgerStatementPdf $pdf)
    {
        $this->authorize('viewAny', CashAccount::class);

        $entries = $cashAccount->ledgerEntries()
            ->with('creator')
            ->when(request('search'), fn ($query, $search) => $query->where('description', 'like', "%{$search}%"))
            ->when(request('from'), fn ($query, $from) => $query->whereDate('transaction_date', '>=', $from))
            ->when(request('to'), fn ($query, $to) => $query->whereDate('transaction_date', '<=', $to))
            ->orderBy('transaction_date')
            ->orderBy('id')
            ->get();

        $filename = 'cash-statement-'.\Illuminate\Support\Str::slug($cashAccount->name).'-'.now()->format('Ymd').'.pdf';

        return response($pdf->build($cashAccount, $entries, 'cash_account'), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
        ]);
    }
}
