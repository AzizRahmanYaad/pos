<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Payroll is now run per individual employee for a chosen date, so a
     * period can hold one run per employee instead of a single run covering
     * everyone. Add the employee link and the reference date, and re-key the
     * per-tenant uniqueness accordingly.
     */
    public function up(): void
    {
        Schema::table('payroll_runs', function (Blueprint $table) {
            $table->foreignId('employee_id')->nullable()->after('id')->constrained('employees')->nullOnDelete();
            $table->date('period_date')->nullable()->after('period_year');
        });

        Schema::table('payroll_runs', function (Blueprint $table) {
            $table->dropUnique('payroll_runs_tenant_period_unique');
            $table->unique(
                ['tenant_id', 'employee_id', 'period_month', 'period_year'],
                'payroll_runs_tenant_employee_period_unique',
            );
        });
    }

    public function down(): void
    {
        Schema::table('payroll_runs', function (Blueprint $table) {
            $table->dropUnique('payroll_runs_tenant_employee_period_unique');
            $table->unique(['tenant_id', 'period_month', 'period_year'], 'payroll_runs_tenant_period_unique');
        });

        Schema::table('payroll_runs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('employee_id');
            $table->dropColumn('period_date');
        });
    }
};
