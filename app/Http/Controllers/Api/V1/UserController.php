<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Users\StoreUserRequest;
use App\Http\Requests\Users\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

class UserController extends Controller
{
    public function index()
    {
        $this->authorize('viewAny', User::class);

        return UserResource::collection(
            User::query()->with('roles')->orderBy('name')->paginate(20)
        );
    }

    public function store(StoreUserRequest $request): UserResource
    {
        $user = User::create([
            ...$request->safe()->except(['password', 'roles', 'logo']),
            'password' => Hash::make($request->validated('password')),
            'logo_path' => $request->file('logo')?->store('logos', 'public'),
            // Every POS account starts with one year of access; the
            // superadmin later extends it year by year against a cash
            // payment. Superadmin accounts themselves never expire.
            'access_expires_at' => in_array('superadmin', $request->validated('roles'), true)
                ? null
                : now()->addYear(),
        ]);

        $user->syncRoles($request->validated('roles'));

        return new UserResource($user->load('roles'));
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
