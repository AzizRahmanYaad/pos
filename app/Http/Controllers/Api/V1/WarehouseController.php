<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Warehouses\StoreWarehouseRequest;
use App\Http\Requests\Warehouses\UpdateWarehouseRequest;
use App\Http\Resources\WarehouseResource;
use App\Models\Warehouse;
use Illuminate\Http\Response;

class WarehouseController extends Controller
{
    public function index()
    {
        $this->authorize('viewAny', Warehouse::class);

        return WarehouseResource::collection(Warehouse::query()->orderBy('name')->get());
    }

    public function store(StoreWarehouseRequest $request): WarehouseResource
    {
        return new WarehouseResource(Warehouse::create($request->validated()));
    }

    public function show(Warehouse $warehouse): WarehouseResource
    {
        $this->authorize('viewAny', Warehouse::class);

        return new WarehouseResource($warehouse);
    }

    public function update(UpdateWarehouseRequest $request, Warehouse $warehouse): WarehouseResource
    {
        $warehouse->update($request->validated());

        return new WarehouseResource($warehouse);
    }

    public function destroy(Warehouse $warehouse): Response
    {
        $this->authorize('delete', $warehouse);

        $warehouse->delete();

        return response()->noContent();
    }
}
