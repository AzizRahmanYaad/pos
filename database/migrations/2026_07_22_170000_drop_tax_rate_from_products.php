<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * tax_rate was never read by any sale/purchase calculation — tax is
     * always an explicit per-line value at the point of sale/purchase, not
     * derived from the product. Dropping the unused column.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('tax_rate');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->decimal('tax_rate', 5, 2)->default(0)->after('default_cost');
        });
    }
};
