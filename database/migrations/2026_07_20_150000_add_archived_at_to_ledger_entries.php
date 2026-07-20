<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Clearing a settled ledger archives its entries instead of deleting
     * them: archived rows disappear from the day-to-day ledger view but
     * remain in the database (and the clearing is recorded in the
     * activity log) for auditing.
     */
    public function up(): void
    {
        Schema::table('ledger_entries', function (Blueprint $table) {
            $table->timestamp('archived_at')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('ledger_entries', function (Blueprint $table) {
            $table->dropColumn('archived_at');
        });
    }
};
