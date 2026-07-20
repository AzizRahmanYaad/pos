<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Users\StoreUserRequest;
use App\Http\Requests\Users\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\Tenant;
use App\Models\User;
use App\Support\TenantProvisioner;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

class UserController extends Controller
{
    public function index()
    {
        $this->authorize('viewAny', User::class);

        return UserResource::collection(
            User::query()->with(['roles', 'tenant'])->orderBy('name')->paginate(20)
        );
    }

    public function store(StoreUserRequest $request, TenantProvisioner $provisioner): UserResource
    {
        $roles = $request->validated('roles');
        $isSuperadmin = in_array('superadmin', $roles, true);
        $foundsBusiness = in_array('admin', $roles, true);

        // Staff accounts (manager/cashier) must join an existing business;
        // an admin account founds a new business of its own.
        abort_if(
            ! $isSuperadmin && ! $foundsBusiness && ! $request->filled('tenant_id'),
            422,
            __('Select the business this staff account belongs to.'),
        );

        $user = DB::transaction(function () use ($request, $provisioner, $roles, $isSuperadmin, $foundsBusiness) {
            $tenantId = null;

            if ($foundsBusiness) {
                $tenant = Tenant::create(['name' => $request->validated('name')]);
                $provisioner->provision($tenant);
                $tenantId = $tenant->id;
            } elseif (! $isSuperadmin) {
                $tenantId = (int) $request->validated('tenant_id');
            }

            $user = User::create([
                ...$request->safe()->except(['password', 'roles', 'logo', 'tenant_id']),
                'tenant_id' => $tenantId,
                'password' => Hash::make($request->validated('password')),
                'logo_path' => $request->file('logo')?->store('logos', 'public'),
                // Every POS account starts with one year of access; the
                // superadmin later extends it year by year against a cash
                // payment. Superadmin accounts themselves never expire.
                'access_expires_at' => $isSuperadmin ? null : now()->addYear(),
            ]);

            $user->syncRoles($roles);

            return $user;
        });

        return new UserResource($user->load(['roles', 'tenant']));
    }

    public function show(User $user): UserResource
    {
        $this->authorize('view', $user);

        return new UserResource($user->load('roles'));
    }

    public function update(UpdateUserRequest $request, User $user): UserResource
    {
        // A user must not be able to lock themselves out by deactivating
        // their own account or dropping their own roles.
        abort_if(
            $user->is($request->user())
                && ($request->has('roles') || ($request->has('is_active') && ! $request->boolean('is_active'))),
            422,
            __('You cannot change your own roles or deactivate your own account.'),
        );

        $data = $request->safe()->except(['password', 'roles', 'logo']);

        if ($request->filled('password')) {
            $data['password'] = Hash::make($request->validated('password'));
        }

        if ($request->hasFile('logo')) {
            if ($user->logo_path) {
                Storage::disk('public')->delete($user->logo_path);
            }
            $data['logo_path'] = $request->file('logo')->store('logos', 'public');
        }

        $user->update($data);

        if ($request->has('roles')) {
            $user->syncRoles($request->validated('roles'));
        }

        return new UserResource($user->load('roles'));
    }

    /**
     * Extend the account's access by one year, paid physically in cash to
     * the superadmin. Extending an already-expired account restarts the
     * year from today; otherwise the year is added on top of the current
     * expiry date.
     */
    public function extend(Request $request, User $user): UserResource
    {
        $this->authorize('extend', $user);

        $base = $user->access_expires_at !== null && $user->access_expires_at->isFuture()
            ? $user->access_expires_at
            : now();

        $user->update(['access_expires_at' => $base->addYear()]);

        return new UserResource($user->load('roles'));
    }

    public function destroy(User $user): Response
    {
        $this->authorize('delete', $user);

        if ($user->logo_path) {
            Storage::disk('public')->delete($user->logo_path);
        }

        $user->delete();

        return response()->noContent();
    }
}
