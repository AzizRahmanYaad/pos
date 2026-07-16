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
        Schema::table('sales', function (Blueprint $table) {
            $table->index(['status', 'sale_date']);
        });

        Schema::table('purchases', function (Blueprint $table) {
            $table->index(['status', 'purchase_date']);
        });

        Schema::table('expenses', function (Blueprint $table) {
            $table->index('expense_date');
            $table->index('is_landed_cost');
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->index('paid_at');
        });

        Schema::table('stock_movements', function (Blueprint $table) {
            $table->index('movement_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropIndex(['status', 'sale_date']);
        });

        Schema::table('purchases', function (Blueprint $table) {
            $table->dropIndex(['status', 'purchase_date']);
        });

        Schema::table('expenses', function (Blueprint $table) {
            $table->dropIndex(['expense_date']);
            $table->dropIndex(['is_landed_cost']);
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex(['paid_at']);
        });

        Schema::table('stock_movements', function (Blueprint $table) {
            $table->dropIndex(['movement_date']);
        });
    }
};
