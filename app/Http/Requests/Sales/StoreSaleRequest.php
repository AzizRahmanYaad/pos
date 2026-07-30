<?php

namespace App\Http\Requests\Sales;

use App\Models\Product;
use App\Models\Sale;
use App\Models\SalePayment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreSaleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Sale::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'customer_id' => ['nullable', Rule::exists('customers', 'id')],
            'warehouse_id' => ['required', Rule::exists('warehouses', 'id')],
            'sale_date' => ['nullable', 'date'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'tax' => ['nullable', 'numeric', 'min:0'],

            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', Rule::exists('products', 'id')],
            'items.*.quantity' => ['required', 'numeric', 'min:0.0001'],
            'items.*.unit_id' => ['required', Rule::exists('units', 'id')],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.discount' => ['nullable', 'numeric', 'min:0'],
            'items.*.tax' => ['nullable', 'numeric', 'min:0'],

            'payments' => ['array'],
            'payments.*.cash_account_id' => ['required_with:payments', Rule::exists('cash_accounts', 'id')],
            'payments.*.method' => ['required_with:payments', Rule::in([
                SalePayment::METHOD_CASH, SalePayment::METHOD_CARD,
                SalePayment::METHOD_MOBILE_WALLET, SalePayment::METHOD_BANK,
            ])],
            'payments.*.amount' => ['required_with:payments', 'numeric', 'min:0.01'],
        ];
    }

    /**
     * Nothing unpriced leaves the shop.
     *
     * A product with no sale price is not one priced at nothing — it is one
     * whose price the shopkeeper has not decided yet, usually because it
     * was entered in a hurry to get it into stock. The till hides those, so
     * this is the same rule stated where it cannot be got around: a line
     * typed straight at the API, or a sale queued by an older version of
     * the app during an outage, is refused on the same grounds.
     *
     * The price on the line is deliberately not what is checked. A cashier
     * may bargain a price down from the shop's own, but inventing one for
     * goods the shop never priced is a different thing entirely.
     *
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                $items = $this->input('items');

                if (! is_array($items)) {
                    return;
                }

                $unpriced = Product::query()
                    ->whereIn('id', collect($items)->pluck('product_id')->filter()->unique())
                    ->where('sale_price', '<=', 0)
                    ->pluck('name', 'id');

                if ($unpriced->isEmpty()) {
                    return;
                }

                foreach ($items as $index => $item) {
                    $name = $unpriced[$item['product_id'] ?? null] ?? null;

                    if ($name !== null) {
                        $validator->errors()->add(
                            "items.{$index}.product_id",
                            __('":name" has no sale price yet. Set its price before selling it.', ['name' => $name]),
                        );
                    }
                }
            },
        ];
    }
}
