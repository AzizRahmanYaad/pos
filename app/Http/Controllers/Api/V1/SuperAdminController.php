<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class SuperAdminController extends Controller
{
    public function __construct()
    {
        $this->middleware(['auth:sanctum', 'role:superadmin']);
    }

    public function listOrganizations(Request $request): JsonResponse
    {
        $query = Organization::query();

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('slug', 'like', "%{$search}%");
            });
        }

        if ($request->has('active')) {
            $query->where('is_active', $request->boolean('active'));
        }

        $organizations = $query
            ->with('adminUser')
            ->orderBy('created_at', 'desc')
            ->paginate($request->input('per_page', 15));

        return response()->json([
            'data' => $organizations->items(),
            'pagination' => [
                'current_page' => $organizations->currentPage(),
                'total' => $organizations->total(),
                'per_page' => $organizations->perPage(),
            ],
        ], 200);
    }

    public function createOrganization(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'name' => 'required|string|max:255|unique:organizations',
                'address' => 'nullable|string|max:500',
                'phone' => 'nullable|string|max:20',
                'admin_name' => 'required|string|max:255',
                'admin_email' => 'required|email|unique:users',
                'admin_password' => 'required|string|min:8',
                'logo_path' => 'nullable|string',
            ]);

            $organization = Organization::createWithAdmin($validated);

            return response()->json([
                'message' => 'POS created successfully',
                'organization' => $organization->load('adminUser'),
                'admin_credentials' => [
                    'email' => $validated['admin_email'],
                    'password' => $validated['admin_password'],
                    'note' => 'Please save these credentials securely. The admin should change password after first login.',
                ],
            ], 201);
        } catch (ValidationException $e) {
            return response()->json(['errors' => $e->errors()], 422);
        }
    }

    public function getOrganization(Organization $organization): JsonResponse
    {
        return response()->json($organization->load('adminUser'), 200);
    }

    public function updateOrganization(Request $request, Organization $organization): JsonResponse
    {
        try {
            $validated = $request->validate([
                'name' => 'nullable|string|max:255|unique:organizations,name,' . $organization->id,
                'address' => 'nullable|string|max:500',
                'phone' => 'nullable|string|max:20',
                'logo_path' => 'nullable|string',
                'is_active' => 'nullable|boolean',
            ]);

            $organization->update($validated);

            return response()->json([
                'message' => 'POS updated successfully',
                'organization' => $organization,
            ], 200);
        } catch (ValidationException $e) {
            return response()->json(['errors' => $e->errors()], 422);
        }
    }

    public function extendSubscription(Request $request, Organization $organization): JsonResponse
    {
        try {
            $validated = $request->validate([
                'years' => 'required|integer|min:1|max:10',
            ]);

            $organization->extendSubscription($validated['years']);

            return response()->json([
                'message' => "Subscription extended by {$validated['years']} year(s)",
                'organization' => $organization,
            ], 200);
        } catch (ValidationException $e) {
            return response()->json(['errors' => $e->errors()], 422);
        }
    }

    public function resetAdminPassword(Request $request, Organization $organization): JsonResponse
    {
        try {
            $validated = $request->validate([
                'new_password' => 'required|string|min:8',
            ]);

            $admin = $organization->adminUser;
            if (!$admin) {
                return response()->json(['error' => 'POS has no admin user'], 404);
            }

            $admin->password = bcrypt($validated['new_password']);
            $admin->save();

            return response()->json([
                'message' => 'Admin password reset successfully',
                'admin' => [
                    'email' => $admin->email,
                    'new_password' => $validated['new_password'],
                    'note' => 'Password has been reset. Admin should change it after login.',
                ],
            ], 200);
        } catch (ValidationException $e) {
            return response()->json(['errors' => $e->errors()], 422);
        }
    }

    public function toggleOrganization(Organization $organization): JsonResponse
    {
        $organization->is_active = !$organization->is_active;
        $organization->save();

        return response()->json([
            'message' => $organization->is_active ? 'POS activated' : 'POS deactivated',
            'organization' => $organization,
        ], 200);
    }

    public function getSubscriptionStats(): JsonResponse
    {
        $stats = [
            'total_pos' => Organization::count(),
            'active_pos' => Organization::where('is_active', true)->count(),
            'expired_subscriptions' => Organization::where('subscription_expires_at', '<', now())->count(),
            'expiring_soon' => Organization::where('subscription_expires_at', '<=', now()->addDays(30))
                ->where('subscription_expires_at', '>', now())
                ->count(),
            'active_subscriptions' => Organization::where('subscription_expires_at', '>', now())->count(),
        ];

        return response()->json($stats, 200);
    }
}
