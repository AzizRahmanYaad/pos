<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Every business table gets a tenant_id so each POS account (business)
     * operates on its own isolated data.
     *
     * @var string[]
     */
    private array $tenantTables = [
        'users',
        'business_settings',
        'categories',
        'units',
        'warehouses',
        'products',
        'product_stocks',
        'stock_movements',
        'customers',
        'suppliers',
        'cash_accounts',
        'ledger_entries',
        'purchases',
        'sales',
        'payments',
        'expense_categories',
        'expenses',
        'employees',
        'payroll_runs',
        'period_closings',
    ];

    public function up(): void
    {
        Schema::create('tenants', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->timestamps();
        });

        foreach ($this->tenantTables as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->unsignedBigInteger('tenant_id')->nullable()->index();
            });
        }

        // Per-tenant uniqueness instead of global uniqueness.
        Schema::table('products', function (Blueprint $table) {
            $table->dropUnique(['sku']);
            $table->dropUnique(['barcode']);
            $table->unique(['tenant_id', 'sku']);
            $table->unique(['tenant_id', 'barcode']);
        });
        Schema::table('payroll_runs', function (Blueprint $table) {
            $table->dropUnique(['period_month', 'period_year']);
            $table->unique(['tenant_id', 'period_month', 'period_year'], 'payroll_runs_tenant_period_unique');
        });
        Schema::table('period_closings', function (Blueprint $table) {
            $table->dropUnique(['period_start', 'period_end']);
            $table->unique(['tenant_id', 'period_start', 'period_end'], 'period_closings_tenant_period_unique');
        });

        $this->backfillExistingDataIntoDefaultTenant();
    }

    /**
     * An already-running installation has one business worth of data;
     * move it (and every non-superadmin user) into a default tenant so
     * nothing disappears when scoping turns on.
     */
    private function backfillExistingDataIntoDefaultTenant(): void
    {
        $superadminRoleId = DB::table('roles')->where('name', 'superadmin')->value('id');

        $hasBusinessUsers = DB::table('users')
            ->when($superadminRoleId, function ($query) use ($superadminRoleId) {
                $query->whereNotIn('id', DB::table('model_has_roles')
                    ->where('role_id', $superadminRoleId)
                    ->where('model_type', 'App\\Models\\User')
                    ->pluck('model_id'));
            })
            ->exists();

        $hasBusinessData = DB::table('warehouses')->exists()
            || DB::table('products')->exists()
            || DB::table('sales')->exists();

        if (! $hasBusinessUsers && ! $hasBusinessData) {
            return;
        }

        $name = DB::table('business_settings')->value('company_name') ?: 'Default Business';
        $tenantId = DB::table('tenants')->insertGetId([
            'name' => $name,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach ($this->tenantTables as $tableName) {
            if ($tableName === 'users') {
                continue;
            }
            DB::table($tableName)->whereNull('tenant_id')->update(['tenant_id' => $tenantId]);
        }

        DB::table('users')
            ->whereNull('tenant_id')
            ->when($superadminRoleId, function ($query) use ($superadminRoleId) {
                $query->whereNotIn('id', DB::table('model_has_roles')
                    ->where('role_id', $superadminRoleId)
                    ->where('model_type', 'App\\Models\\User')
                    ->pluck('model_id'));
            })
            ->update(['tenant_id' => $tenantId]);
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropUnique(['tenant_id', 'sku']);
            $table->dropUnique(['tenant_id', 'barcode']);
            $table->unique(['sku']);
            $table->unique(['barcode']);
        });
        Schema::table('payroll_runs', function (Blueprint $table) {
            $table->dropUnique('payroll_runs_tenant_period_unique');
            $table->unique(['period_month', 'period_year']);
        });
        Schema::table('period_closings', function (Blueprint $table) {
            $table->dropUnique('period_closings_tenant_period_unique');
            $table->unique(['period_start', 'period_end']);
        });

        foreach ($this->tenantTables as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropColumn('tenant_id');
            });
        }

        Schema::drop('tenants');
    }
};
