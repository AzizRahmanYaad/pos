<?php

namespace App\Http\Requests\Sales;

use App\Models\Sale;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RefundSaleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('sale'));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $saleId = $this->route('sale') instanceof Sale ? $this->route('sale')->id : $this->route('sale');

        return [
            // Omitted entirely = refund everything still outstanding.
            'items' => ['nullable', 'array', 'min:1'],
            'items.*.sale_item_id' => [
                'required_with:items',
                Rule::exists('sale_items', 'id')->where('sale_id', $saleId),
            ],
            'items.*.quantity' => ['required_with:items', 'numeric', 'min:0.0001'],
        ];
    }
}
