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
        Schema::table('employee_advances', function (Blueprint $table) {
            $table->foreign('deducted_in_payroll_item_id')->references('id')->on('payroll_items')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('employee_advances', function (Blueprint $table) {
            $table->dropForeign(['deducted_in_payroll_item_id']);
        });
    }
};
