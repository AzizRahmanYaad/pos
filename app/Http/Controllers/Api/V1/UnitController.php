<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Products\StoreUnitRequest;
use App\Http\Requests\Products\UpdateUnitRequest;
use App\Http\Resources\UnitResource;
use App\Models\Unit;
use Illuminate\Http\Response;

class UnitController extends Controller
{
    public function index()
    {
        $this->authorize('viewAny', Unit::class);

        return UnitResource::collection(Unit::query()->orderBy('name')->get());
    }

    public function store(StoreUnitRequest $request): UnitResource
    {
        return new UnitResource(Unit::create($request->validated()));
    }

    public function show(Unit $unit): UnitResource
    {
        $this->authorize('viewAny', Unit::class);

        return new UnitResource($unit);
    }

    public function update(UpdateUnitRequest $request, Unit $unit): UnitResource
    {
        $unit->update($request->validated());

        return new UnitResource($unit);
    }

    public function destroy(Unit $unit): Response
    {
        $this->authorize('delete', $unit);

        $unit->delete();

        return response()->noContent();
    }
}
