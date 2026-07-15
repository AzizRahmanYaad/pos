<?php

namespace App\Http\Requests\Products;

use App\Models\Unit;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreUnitRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Unit::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'short_name' => ['required', 'string', 'max:16'],
            'base_unit_id' => ['nullable', Rule::exists('units', 'id')],
            'conversion_factor' => ['required', 'numeric', 'min:0.0001'],
        ];
    }
}
