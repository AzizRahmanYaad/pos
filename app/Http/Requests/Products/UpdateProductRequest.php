<?php

namespace App\Http\Requests\Products;

use App\Models\Product;
use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('product'));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $productId = $this->route('product')?->id;

        return [
            'sku' => ['sometimes', 'required', 'string', 'max:64', Rule::unique('products', 'sku')->where('tenant_id', TenantContext::id())->ignore($productId)],
            'barcode' => ['nullable', 'string', 'max:64', Rule::unique('products', 'barcode')->where('tenant_id', TenantContext::id())->ignore($productId)],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'category_id' => ['nullable', Rule::exists('categories', 'id')],
            'unit_id' => ['sometimes', 'required', Rule::exists('units', 'id')],
            'type' => ['sometimes', 'required', Rule::in([
                Product::TYPE_STANDARD, Product::TYPE_SERVICE, Product::TYPE_RAW_MATERIAL,
            ])],
            'sale_price' => ['sometimes', 'required', 'numeric', 'min:0'],
            'pricing_mode' => ['sometimes', 'required', Rule::in([Product::PRICING_FIXED, Product::PRICING_MARGIN])],
            'margin_percent' => ['nullable', 'numeric', 'min:0', 'max:1000', 'required_if:pricing_mode,margin'],
            'default_cost' => ['sometimes', 'required', 'numeric', 'min:0'],
            'tax_rate' => ['sometimes', 'required', 'numeric', 'min:0', 'max:100'],
            'reorder_level' => ['sometimes', 'required', 'numeric', 'min:0'],
            'track_inventory' => ['sometimes', 'boolean'],
            'attributes' => ['nullable', 'array'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
