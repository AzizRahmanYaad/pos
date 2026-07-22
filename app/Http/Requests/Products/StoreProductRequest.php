<?php

namespace App\Http\Requests\Products;

use App\Models\Product;
use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Product::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'sku' => ['required', 'string', 'max:64', Rule::unique('products', 'sku')->where('tenant_id', TenantContext::id())],
            'barcode' => ['nullable', 'string', 'max:64', Rule::unique('products', 'barcode')->where('tenant_id', TenantContext::id())],
            'name' => ['required', 'string', 'max:255'],
            'category_id' => ['nullable', Rule::exists('categories', 'id')],
            'unit_id' => ['required', Rule::exists('units', 'id')],
            'type' => ['required', Rule::in([
                Product::TYPE_STANDARD, Product::TYPE_SERVICE, Product::TYPE_RAW_MATERIAL,
            ])],
            'sale_price' => ['required', 'numeric', 'min:0'],
            'pricing_mode' => ['nullable', Rule::in([Product::PRICING_FIXED, Product::PRICING_MARGIN])],
            'margin_percent' => ['nullable', 'numeric', 'min:0', 'max:1000', 'required_if:pricing_mode,margin'],
            'default_cost' => ['required', 'numeric', 'min:0'],
            'tax_rate' => ['required', 'numeric', 'min:0', 'max:100'],
            'reorder_level' => ['required', 'numeric', 'min:0'],
            'track_inventory' => ['boolean'],
            'attributes' => ['nullable', 'array'],
            'is_active' => ['boolean'],
        ];
    }
}
