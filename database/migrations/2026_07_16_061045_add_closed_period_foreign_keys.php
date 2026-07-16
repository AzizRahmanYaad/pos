<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tables that carry a nullable closed_period_id column, added before
     * period_closings existed. Now that it does, wire up the FK.
     *
     * @var string[]
     */
    private array $tables = [
        'ledger_entries', 'purchases', 'sales', 'expenses', 'payments', 'employee_advances',
    ];

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        foreach ($this->tables as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->foreign('closed_period_id')->references('id')->on('period_closings')->nullOnDelete();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        foreach ($this->tables as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropForeign(['closed_period_id']);
            });
        }
    }
};
