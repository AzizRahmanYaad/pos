<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $tables = [
            'users', 'categories', 'units', 'warehouses', 'products',
            'product_stocks', 'stock_movements', 'suppliers', 'customers',
            'cash_accounts', 'purchases', 'purchase_items', 'purchase_landed_costs',
            'sales', 'sale_items', 'payments', 'expense_categories', 'expenses',
            'employees', 'employee_advances', 'payroll_runs', 'payroll_items',
            'period_closings', 'period_closing_snapshots', 'ledger_entries'
        ];

        foreach ($tables as $table) {
            if (Schema::hasTable($table)) {
                Schema::table($table, function (Blueprint $t) {
                    if (!Schema::hasColumn($t->getTable(), 'organization_id')) {
                        $t->unsignedBigInteger('organization_id')->nullable()->after('id');
                        $t->index('organization_id');
                    }
                });
            }
        }
    }

    public function down(): void
    {
        $tables = [
            'users', 'categories', 'units', 'warehouses', 'products',
            'product_stocks', 'stock_movements', 'suppliers', 'customers',
            'cash_accounts', 'purchases', 'purchase_items', 'purchase_landed_costs',
            'sales', 'sale_items', 'payments', 'expense_categories', 'expenses',
            'employees', 'employee_advances', 'payroll_runs', 'payroll_items',
            'period_closings', 'period_closing_snapshots', 'ledger_entries'
        ];

        foreach ($tables as $table) {
            if (Schema::hasTable($table)) {
                Schema::table($table, function (Blueprint $t) {
                    if (Schema::hasColumn($t->getTable(), 'organization_id')) {
                        $t->dropIndex(['organization_id']);
                        $t->dropColumn('organization_id');
                    }
                });
            }
        }
    }
};
