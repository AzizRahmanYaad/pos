<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One row of the activity screen. The label and the changed fields are read
 * from the entry's own properties rather than from the record itself, so an
 * entry still reads correctly after that record has been deleted.
 */
class ActivityEntryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $properties = $this->properties ?? collect();
        // Model events write the before/after into its own column; the
        // request-level recorder writes context into properties.
        $attributeChanges = $this->attribute_changes ?? collect();
        $changes = $attributeChanges->get('attributes', []);
        $previous = $attributeChanges->get('old', []);

        return [
            'id' => $this->id,
            'module' => $this->log_name,
            'event' => $this->event ?? $this->description,
            'description' => $this->description,
            'subject_label' => $properties->get('subject_label'),
            'subject_type' => $this->subject_type === null ? null : class_basename($this->subject_type),
            'subject_id' => $this->subject_id,
            'user_id' => $this->causer_id,
            'user_name' => $this->causer?->name,
            'ip_address' => $this->ip_address,
            'path' => $properties->get('path'),
            'method' => $properties->get('method'),
            // Field-by-field before/after, for the expandable detail row.
            'changes' => $this->diff(is_array($changes) ? $changes : [], is_array($previous) ? $previous : []),
            'created_at' => $this->created_at,
        ];
    }

    /**
     * @param  array<string, mixed>  $current
     * @param  array<string, mixed>  $previous
     * @return array<int, array{field:string, from:mixed, to:mixed}>
     */
    private function diff(array $current, array $previous): array
    {
        $fields = array_keys($current + $previous);

        return array_values(array_map(fn (string $field) => [
            'field' => $field,
            'from' => $this->scalar($previous[$field] ?? null),
            'to' => $this->scalar($current[$field] ?? null),
        ], $fields));
    }

    private function scalar(mixed $value): mixed
    {
        if (is_array($value) || is_object($value)) {
            return json_encode($value, JSON_UNESCAPED_UNICODE);
        }

        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }

        return $value;
    }
}
