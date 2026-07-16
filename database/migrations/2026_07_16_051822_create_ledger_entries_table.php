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
        Schema::create('ledger_entries', function (Blueprint $table) {
            $table->id();
            $table->morphs('ledgerable');
            $table->string('entry_type', 8);
            $table->decimal('amount', 14, 2);
            $table->decimal('running_balance', 14, 2);
            $table->nullableMorphs('source');
            $table->string('description')->nullable();
            $table->dateTime('transaction_date');
            $table->unsignedBigInteger('closed_period_id')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['ledgerable_type', 'ledgerable_id', 'transaction_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ledger_entries');
    }
};
