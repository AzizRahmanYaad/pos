<?php

namespace Database\Factories;

use App\Models\Product;
use App\Models\Unit;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'sku' => $this->faker->unique()->bothify('SKU-####'),
            'barcode' => $this->faker->unique()->ean13(),
            'name' => $this->faker->unique()->words(3, true),
            'unit_id' => Unit::factory(),
            'type' => Product::TYPE_STANDARD,
            'sale_price' => $this->faker->randomFloat(2, 1, 500),
            'default_cost' => $this->faker->randomFloat(2, 1, 300),
            'reorder_level' => 5,
            'track_inventory' => true,
            'is_active' => true,
        ];
    }
}
