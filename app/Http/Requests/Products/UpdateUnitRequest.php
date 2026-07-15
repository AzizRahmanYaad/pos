<?php

namespace App\Http\Requests\Products;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUnitRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('unit'));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'short_name' => ['sometimes', 'required', 'string', 'max:16'],
            'base_unit_id' => ['nullable', Rule::exists('units', 'id')->whereNot('id', $this->route('unit')?->id)],
            'conversion_factor' => ['sometimes', 'required', 'numeric', 'min:0.0001'],
        ];
    }
}
