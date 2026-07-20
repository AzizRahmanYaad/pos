<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\User;

class TenantController extends Controller
{
    /**
     * List the businesses on the platform so the superadmin can attach
     * staff accounts to the right one.
     */
    public function index()
    {
        $this->authorize('viewAny', User::class);

        return Tenant::query()
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Tenant $tenant) => ['id' => $tenant->id, 'name' => $tenant->name]);
    }
}
