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
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->morphs('party');
            $table->string('direction', 4);
            $table->decimal('amount', 14, 2);
            $table->foreignId('cash_account_id')->constrained('cash_accounts')->restrictOnDelete();
            $table->string('method', 32);
            $table->nullableMorphs('reference');
            $table->string('description')->nullable();
            $table->dateTime('paid_at');
            $table->foreignId('received_by')->constrained('users')->restrictOnDelete();
            $table->unsignedBigInteger('closed_period_id')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
