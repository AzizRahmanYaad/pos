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
        Schema::create('employee_advances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->restrictOnDelete();
            $table->foreignId('cash_account_id')->constrained('cash_accounts')->restrictOnDelete();
            $table->decimal('amount', 14, 2);
            $table->dateTime('advance_date');
            $table->string('reason')->nullable();
            // FK to payroll_items added in a later migration, once that
            // table exists (payroll_items is created after this one).
            $table->unsignedBigInteger('deducted_in_payroll_item_id')->nullable();
            $table->unsignedBigInteger('closed_period_id')->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('employee_advances');
    }
};
