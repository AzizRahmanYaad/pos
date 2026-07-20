<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Users\StoreUserRequest;
use App\Http\Requests\Users\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;

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
            ...$request->safe()->except(['password', 'roles']),
            'password' => Hash::make($request->validated('password')),
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

        $data = $request->safe()->except(['password', 'roles']);

        if ($request->filled('password')) {
            $data['password'] = Hash::make($request->validated('password'));
        }

        $user->update($data);

        if ($request->has('roles')) {
            $user->syncRoles($request->validated('roles'));
        }

        return new UserResource($user->load('roles'));
    }

    public function destroy(User $user): Response
    {
        $this->authorize('delete', $user);

        $user->delete();

        return response()->noContent();
    }
}
