<?php

namespace Database\Factories;

use App\Models\Purchase;
use App\Models\Supplier;
use App\Models\Warehouse;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Purchase>
 */
class PurchaseFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'purchase_number' => 'PUR-'.$this->faker->unique()->numerify('######'),
            'supplier_id' => Supplier::factory(),
            'warehouse_id' => Warehouse::factory(),
            'status' => Purchase::STATUS_DRAFT,
            'purchase_date' => now(),
            'subtotal' => 0,
            'discount' => 0,
            'tax' => 0,
            'landed_cost_total' => 0,
            'grand_total' => 0,
            'paid_amount' => 0,
            'due_amount' => 0,
        ];
    }
}
