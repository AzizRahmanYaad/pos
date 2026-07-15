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
        Schema::create('business_settings', function (Blueprint $table) {
            $table->id();
            $table->string('company_name')->default('My Business');
            $table->string('address')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('logo_path')->nullable();
            $table->string('currency_code', 8)->default('AFN');
            $table->string('currency_symbol', 8)->default('؋');
            $table->string('default_locale', 8)->default('en');
            $table->unsignedTinyInteger('fiscal_year_start_month')->default(1);
            $table->string('invoice_prefix', 16)->default('INV-');
            $table->string('purchase_prefix', 16)->default('PUR-');
            $table->text('receipt_footer')->nullable();
            $table->decimal('default_tax_rate', 5, 2)->default(0);
            $table->boolean('auto_close_daily')->default(false);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('business_settings');
    }
};
