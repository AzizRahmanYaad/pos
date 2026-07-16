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
        Schema::table('purchase_landed_costs', function (Blueprint $table) {
            $table->foreign('expense_id')->references('id')->on('expenses')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('purchase_landed_costs', function (Blueprint $table) {
            $table->dropForeign(['expense_id']);
        });
    }
};
