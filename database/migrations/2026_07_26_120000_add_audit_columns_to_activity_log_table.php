<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Turns the activity log into a real audit trail: which business the entry
 * belongs to (so one company never reads another's), and where the action
 * came from. Without tenant_id the log would be the one table in the
 * application that leaks across businesses.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('activity_log', function (Blueprint $table) {
            // Null means the platform owner acted outside any business.
            $table->unsignedBigInteger('tenant_id')->nullable()->after('id')->index();
            $table->string('ip_address', 45)->nullable()->after('properties');
            $table->string('user_agent')->nullable()->after('ip_address');
        });

        Schema::table('activity_log', function (Blueprint $table) {
            // The log is always read newest-first, usually filtered by who
            // did it, and it is the fastest-growing table in the system.
            $table->index(['tenant_id', 'created_at'], 'activity_log_tenant_created_index');
            $table->index(['causer_id', 'created_at'], 'activity_log_causer_created_index');
        });
    }

    public function down(): void
    {
        Schema::table('activity_log', function (Blueprint $table) {
            $table->dropIndex('activity_log_tenant_created_index');
            $table->dropIndex('activity_log_causer_created_index');
            $table->dropColumn(['tenant_id', 'ip_address', 'user_agent']);
        });
    }
};
