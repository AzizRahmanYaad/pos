<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'address' => $this->address,
            'tenant_id' => $this->tenant_id,
            'tenant_name' => $this->whenLoaded('tenant', fn () => $this->tenant?->name),
            'logo_url' => $this->logo_path ? Storage::disk('public')->url($this->logo_path) : null,
            'locale' => $this->locale,
            'is_active' => $this->is_active,
            'access_expires_at' => $this->access_expires_at,
            'roles' => $this->whenLoaded('roles', fn () => $this->roles->pluck('name')),
            // Everything this account can actually do, role and directly
            // assigned permissions combined — this is what the navigation
            // and every frontend guard is driven from.
            'permissions' => $this->when(
                $this->relationLoaded('roles') || $this->relationLoaded('permissions'),
                fn () => $this->getAllPermissions()->pluck('name')->values(),
            ),
            // Just the ticked boxes, so the permission screen reopens
            // showing what was actually saved against the account.
            'direct_permissions' => $this->whenLoaded('permissions', fn () => $this->permissions->pluck('name')->values()),
            'created_at' => $this->created_at,
        ];
    }
}
