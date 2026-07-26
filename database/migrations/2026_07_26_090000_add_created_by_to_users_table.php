<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Records who opened each account, so a Company Admin's reach stops at the
 * staff they took on themselves. Two admins in one business can then run
 * their own people without seeing — or being able to touch — each other's.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Null means nobody on the platform opened it: the seeded
            // accounts, and anything predating this column.
            $table->foreignId('created_by')->nullable()->after('tenant_id')
                ->constrained('users')->nullOnDelete();
        });

        // Existing staff have no recorded creator, which would leave them
        // stranded — invisible to every admin. Hand each business's accounts
        // to that business's first admin, who is who created them in
        // practice. Their own account stays null; an admin always sees
        // themselves regardless.
        $firstAdminPerTenant = DB::table('users')
            ->join('model_has_roles', function ($join) {
                $join->on('model_has_roles.model_id', '=', 'users.id')
                    ->where('model_has_roles.model_type', '=', \App\Models\User::class);
            })
            ->join('roles', 'roles.id', '=', 'model_has_roles.role_id')
            ->where('roles.name', 'admin')
            ->whereNotNull('users.tenant_id')
            ->orderBy('users.id')
            ->get(['users.id', 'users.tenant_id'])
            ->unique('tenant_id')
            ->pluck('id', 'tenant_id');

        foreach ($firstAdminPerTenant as $tenantId => $adminId) {
            DB::table('users')
                ->where('tenant_id', $tenantId)
                ->where('id', '!=', $adminId)
                ->whereNull('created_by')
                ->update(['created_by' => $adminId]);
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('created_by');
        });
    }
};
