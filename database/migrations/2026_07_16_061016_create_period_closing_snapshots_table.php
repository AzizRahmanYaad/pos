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
        Schema::create('period_closing_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('period_closing_id')->constrained('period_closings')->cascadeOnDelete();
            $table->string('snapshot_type', 32);
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->string('reference_label')->nullable();
            $table->decimal('amount', 16, 2)->default(0);
            $table->decimal('quantity', 14, 4)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['period_closing_id', 'snapshot_type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('period_closing_snapshots');
    }
};
