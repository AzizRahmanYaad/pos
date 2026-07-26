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
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', User::class);

        $actor = $request->user();

        $users = UserResource::collection(
            User::query()
                ->with(['roles', 'permissions', 'tenant'])
                // A Company Admin sees the staff they took on, and
                // themselves — nothing else. Another admin in the same
                // business, and anyone that admin hired, stay invisible.
                ->unless($actor->isPlatformOwner(), fn ($query) => $query
                    ->where('tenant_id', $actor->tenant_id)
                    ->where(fn ($scope) => $scope
                        ->where('created_by', $actor->id)
                        ->orWhere('id', $actor->id)))
                ->orderBy('name')
                ->paginate(20)
        );

        // A Company Admin needs to know where they stand against their
        // allowance before they hit it, not only once creation fails.
        $tenant = $actor->isPlatformOwner() ? null : $actor->tenant;

        return $users->additional([
            'limit' => $tenant === null ? null : [
                'max_users' => $tenant->max_users,
                'user_count' => $tenant->staffCount(),
                'remaining' => $tenant->remainingUserSlots(),
                'reached' => $tenant->hasReachedUserLimit(),
            ],
        ]);
    }

    public function store(StoreUserRequest $request, TenantProvisioner $provisioner): UserResource
    {
        $actor = $request->user();
        $roles = $request->validated('roles');
        $isPlatformOwner = $actor->isPlatformOwner();

        // Only the platform owner creates platform accounts and founds new
        // businesses. For a Company Admin every account lands in their own
        // business, whatever the request body asks for.
        $createsSuperadmin = $isPlatformOwner && in_array('superadmin', $roles, true);
        $foundsBusiness = $isPlatformOwner && in_array('admin', $roles, true);

        if ($isPlatformOwner && ! $createsSuperadmin && ! $foundsBusiness && ! $request->filled('tenant_id')) {
            throw ValidationException::withMessages([
                'tenant_id' => __('Select the business this staff account belongs to.'),
            ]);
        }

        $targetTenant = null;

        if (! $foundsBusiness && ! $createsSuperadmin) {
            $targetTenant = $isPlatformOwner
                ? Tenant::findOrFail((int) $request->validated('tenant_id'))
                : $actor->tenant()->firstOrFail();

            $this->assertHasRoomForAnotherUser($targetTenant);
        }

        $user = DB::transaction(function () use ($request, $provisioner, $roles, $createsSuperadmin, $foundsBusiness, $targetTenant) {
            if ($foundsBusiness) {
                $targetTenant = Tenant::create([
                    'name' => $request->validated('name'),
                    // Every business starts on the standard allowance; the
                    // superadmin can raise or lower it per company later.
                    'max_users' => $request->validated('max_users') ?? Tenant::DEFAULT_MAX_USERS,
                ]);
                $provisioner->provision($targetTenant);
            }

            $user = User::create([
                ...$request->safe()->except(['password', 'roles', 'permissions', 'logo', 'tenant_id', 'max_users']),
                'tenant_id' => $createsSuperadmin ? null : $targetTenant?->id,
                // Who opened this account decides who may later manage it.
                'created_by' => $request->user()->id,
                'password' => Hash::make($request->validated('password')),
                'logo_path' => $request->file('logo')?->store('logos', 'public'),
                // Every POS account starts with one year of access; the
                // superadmin later extends it year by year against a cash
                // payment. Superadmin accounts themselves never expire.
                'access_expires_at' => $createsSuperadmin ? null : now()->addYear(),
            ]);

            $user->syncRoles($roles);
            $this->syncPermissions($request, $user);

            return $user;
        });

        return new UserResource($user->load(['roles', 'permissions', 'tenant']));
    }

    public function show(User $user): UserResource
    {
        $this->authorize('view', $user);

        return new UserResource($user->load(['roles', 'permissions']));
    }

    public function update(UpdateUserRequest $request, User $user): UserResource
    {
        // A user must not be able to lock themselves out by deactivating
        // their own account or dropping their own roles.
        abort_if(
            $user->is($request->user())
                && ($request->has('roles') || $request->has('permissions') || ($request->has('is_active') && ! $request->boolean('is_active'))),
            422,
            __('You cannot change your own roles, permissions, or deactivate your own account.'),
        );

        $data = $request->safe()->except(['password', 'roles', 'permissions', 'logo']);

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

        $this->syncPermissions($request, $user);

        return new UserResource($user->load(['roles', 'permissions']));
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

        return new UserResource($user->load(['roles', 'permissions']));
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

    /**
     * Stop a business adding accounts beyond the allowance the platform
     * owner granted it, with a message that says what to do about it
     * rather than just refusing.
     */
    private function assertHasRoomForAnotherUser(Tenant $tenant): void
    {
        if (! $tenant->hasReachedUserLimit()) {
            return;
        }

        throw ValidationException::withMessages([
            'limit' => __(
                'This business has used all :max of the staff accounts it may create. Remove a user first, or ask the platform administrator to raise the limit.',
                ['max' => $tenant->max_users],
            ),
        ]);
    }

    /**
     * Persist exactly the permissions that were ticked. They are stored on
     * the account rather than inherited from a role, so unticking one
     * always takes effect — see Permissions::rolePermissions().
     */
    private function syncPermissions(Request $request, User $user): void
    {
        if (! $request->has('permissions')) {
            return;
        }

        $user->syncPermissions($request->validated('permissions') ?? []);
    }
}
