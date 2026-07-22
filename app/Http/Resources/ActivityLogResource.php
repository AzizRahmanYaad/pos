<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ActivityLogResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'event' => $this->event,
            'description' => $this->description,
            'causer_name' => $this->whenLoaded('causer', fn () => $this->causer?->name),
            'properties' => $this->properties,
            'created_at' => $this->created_at,
        ];
    }
}
