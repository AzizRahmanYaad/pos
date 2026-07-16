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
        Schema::create('purchase_landed_costs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_id')->constrained('purchases')->cascadeOnDelete();
            // References an `expenses` row once the Expenses module (a later
            // migration) creates that table; left unconstrained here to
            // avoid a forward dependency, constrained there instead.
            $table->unsignedBigInteger('expense_id')->nullable();
            $table->string('description');
            $table->decimal('amount', 14, 2);
            $table->string('allocation_method', 16)->default('by_value');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('purchase_landed_costs');
    }
};
