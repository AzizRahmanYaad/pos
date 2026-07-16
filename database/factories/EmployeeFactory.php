<?php

namespace Database\Factories;

use App\Models\Employee;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Employee>
 */
class EmployeeFactory extends Factory
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
            'designation' => $this->faker->jobTitle(),
            'salary_amount' => 500,
            'salary_type' => Employee::SALARY_MONTHLY,
            'hire_date' => now()->subMonths(6),
            'is_active' => true,
        ];
    }
}
