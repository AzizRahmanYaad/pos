<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('payroll_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payroll_run_id')->constrained('payroll_runs')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('employees')->restrictOnDelete();
            $table->decimal('base_salary', 14, 2)->default(0);
            $table->decimal('advances_deducted', 14, 2)->default(0);
            $table->decimal('other_deductions', 14, 2)->default(0);
            $table->decimal('bonuses', 14, 2)->default(0);
            $table->decimal('net_pay', 14, 2)->default(0);
            $table->timestamps();

            $table->unique(['payroll_run_id', 'employee_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payroll_items');
    }
};
