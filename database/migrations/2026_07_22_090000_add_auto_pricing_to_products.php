<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Lets a product opt into margin-based pricing: instead of a fixed
     * sale_price the owner edits by hand, sale_price is recalculated
     * automatically from the product's blended cost plus a target margin
     * whenever a purchase changes that cost. Existing products default to
     * 'fixed' so nothing changes for them.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('pricing_mode', 16)->default('fixed')->after('sale_price');
            $table->decimal('margin_percent', 6, 2)->nullable()->after('pricing_mode');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['pricing_mode', 'margin_percent']);
        });
    }
};
