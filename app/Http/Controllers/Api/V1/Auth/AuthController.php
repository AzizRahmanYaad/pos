<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\UpdatePasswordRequest;
use App\Http\Resources\UserResource;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(LoginRequest $request): UserResource
    {
        $request->authenticate();
        $request->session()->regenerate();

        return new UserResource($request->user()->load('roles'));
    }

    public function logout(Request $request): Response
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }

    public function me(Request $request): UserResource
    {
        return new UserResource($request->user()->load('roles'));
    }

    public function updatePassword(UpdatePasswordRequest $request): Response
    {
        $request->user()->update([
            'password' => Hash::make($request->validated('password')),
        ]);

        return response()->noContent();
    }
}
