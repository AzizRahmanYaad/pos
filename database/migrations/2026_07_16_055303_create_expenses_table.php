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
        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('expense_category_id')->constrained('expense_categories')->restrictOnDelete();
            $table->foreignId('warehouse_id')->nullable()->constrained('warehouses')->nullOnDelete();
            $table->foreignId('cash_account_id')->constrained('cash_accounts')->restrictOnDelete();
            $table->decimal('amount', 14, 2);
            $table->dateTime('expense_date');
            $table->string('paid_to')->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_landed_cost')->default(false);
            $table->foreignId('purchase_id')->nullable()->constrained('purchases')->nullOnDelete();
            $table->string('receipt_attachment')->nullable();
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
        Schema::dropIfExists('expenses');
    }
};
