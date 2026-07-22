<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->string('status', 24)->default('completed')->change();
        });

        Schema::table('sale_items', function (Blueprint $table) {
            $table->decimal('refunded_quantity', 14, 4)->default(0)->after('quantity');
        });
    }

    public function down(): void
    {
        Schema::table('sale_items', function (Blueprint $table) {
            $table->dropColumn('refunded_quantity');
        });

        Schema::table('sales', function (Blueprint $table) {
            $table->string('status', 16)->default('completed')->change();
        });
    }
};
