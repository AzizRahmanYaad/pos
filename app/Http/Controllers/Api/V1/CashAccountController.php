<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Parties\StoreCashAccountRequest;
use App\Http\Requests\Parties\UpdateCashAccountRequest;
use App\Http\Resources\CashAccountResource;
use App\Models\CashAccount;
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
}
