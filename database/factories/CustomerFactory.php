<?php

namespace Database\Factories;

use App\Models\Customer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Customer>
 */
class CustomerFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => $this->faker->unique()->name(),
            'phone' => $this->faker->phoneNumber(),
            'opening_balance' => 0,
            'opening_balance_type' => 'debit',
            'credit_limit' => 0,
            'is_active' => true,
        ];
    }
}
