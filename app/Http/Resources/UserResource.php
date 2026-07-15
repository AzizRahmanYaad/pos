<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

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
            'locale' => $this->locale,
            'is_active' => $this->is_active,
            'roles' => $this->whenLoaded('roles', fn () => $this->roles->pluck('name')),
            'permissions' => $this->when(
                $this->relationLoaded('roles'),
                fn () => $this->getAllPermissions()->pluck('name'),
            ),
            'created_at' => $this->created_at,
        ];
    }
}
