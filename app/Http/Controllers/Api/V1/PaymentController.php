<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Payments\Actions\RecordPaymentAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Payments\StorePaymentRequest;
use App\Http\Resources\PaymentResource;
use App\Models\CashAccount;
use App\Models\Customer;
use App\Models\Payment;
use App\Models\Purchase;
use App\Models\Sale;
use App\Models\Supplier;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class PaymentController extends Controller
{
    public function index()
    {
        $this->authorize('viewAny', Payment::class);

        $payments = QueryBuilder::for(Payment::class)
            ->allowedFilters(
                AllowedFilter::exact('party_type'),
                AllowedFilter::exact('party_id'),
                AllowedFilter::exact('direction'),
            )
            ->allowedSorts('paid_at', 'created_at', 'amount')
            ->with(['party', 'cashAccount', 'receiver'])
            ->defaultSort('-paid_at')
            ->paginate(request()->integer('per_page', 25));

        return PaymentResource::collection($payments);
    }

    public function store(StorePaymentRequest $request, RecordPaymentAction $recordPayment): PaymentResource
    {
        $party = $request->validated('party_type') === 'customer'
            ? Customer::findOrFail($request->validated('party_id'))
            : Supplier::findOrFail($request->validated('party_id'));

        $reference = null;
        if ($request->validated('reference_type') === 'sale') {
            $reference = Sale::findOrFail($request->validated('reference_id'));
        } elseif ($request->validated('reference_type') === 'purchase') {
            $reference = Purchase::findOrFail($request->validated('reference_id'));
        }

        $payment = $recordPayment->execute(
            party: $party,
            direction: $request->validated('direction'),
            amount: (float) $request->validated('amount'),
            cashAccount: CashAccount::findOrFail($request->validated('cash_account_id')),
            method: $request->validated('method'),
            description: $request->validated('description'),
            reference: $reference,
            receivedBy: $request->user()->id,
        );

        return new PaymentResource($payment->load(['party', 'cashAccount', 'receiver']));
    }
}
