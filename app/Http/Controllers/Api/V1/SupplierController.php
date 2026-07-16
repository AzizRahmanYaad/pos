<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Parties\StoreSupplierRequest;
use App\Http\Requests\Parties\UpdateSupplierRequest;
use App\Http\Resources\LedgerEntryResource;
use App\Http\Resources\SupplierResource;
use App\Models\Supplier;
use Illuminate\Http\Response;

class SupplierController extends Controller
{
    public function index()
    {
        $this->authorize('viewAny', Supplier::class);

        return SupplierResource::collection(Supplier::query()->orderBy('name')->paginate(request()->integer('per_page', 20)));
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
            ->orderByDesc('transaction_date')
            ->orderByDesc('id')
            ->paginate(request()->integer('per_page', 25));

        return LedgerEntryResource::collection($entries)->additional([
            'current_balance' => $supplier->currentBalance(),
        ]);
    }
}
