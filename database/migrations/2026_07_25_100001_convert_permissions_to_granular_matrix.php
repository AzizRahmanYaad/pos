<?php

use App\Support\Permissions;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Swaps the coarse `module.manage` permissions for the granular
 * `module.action` matrix.
 *
 * Every role and every account that held a coarse permission is granted
 * the exact set of granular permissions it stood for, so access is
 * unchanged the moment this runs — the difference is only that an admin
 * can now hand out a slice of a module instead of all of it.
 */
return new class extends Migration
{
    public function up(): void
    {
        $map = Permissions::legacyMap();

        // 1. Create every granular permission.
        $now = now();
        foreach (Permissions::all() as $name) {
            DB::table('permissions')->updateOrInsert(
                ['name' => $name, 'guard_name' => 'web'],
                ['created_at' => $now, 'updated_at' => $now],
            );
        }

        $idsByName = DB::table('permissions')->where('guard_name', 'web')->pluck('id', 'name');

        // 2. Grant the replacements everywhere a legacy permission was held,
        //    for roles and for directly-permissioned accounts alike.
        foreach ($map as $legacyName => $replacements) {
            $legacyId = $idsByName[$legacyName] ?? null;

            if ($legacyId === null) {
                continue;
            }

            $replacementIds = array_values(array_filter(
                array_map(fn (string $name) => $idsByName[$name] ?? null, $replacements),
            ));

            $roleIds = DB::table('role_has_permissions')->where('permission_id', $legacyId)->pluck('role_id');
            foreach ($roleIds as $roleId) {
                foreach ($replacementIds as $permissionId) {
                    DB::table('role_has_permissions')->updateOrInsert(
                        ['permission_id' => $permissionId, 'role_id' => $roleId],
                    );
                }
            }

            $models = DB::table('model_has_permissions')->where('permission_id', $legacyId)->get();
            foreach ($models as $model) {
                foreach ($replacementIds as $permissionId) {
                    DB::table('model_has_permissions')->updateOrInsert([
                        'permission_id' => $permissionId,
                        'model_type' => $model->model_type,
                        'model_id' => $model->model_id,
                    ]);
                }
            }
        }

        // 3. Staff roles become label-only presets, so anything they still
        //    grant has to move onto the accounts themselves first —
        //    otherwise the seeder stripping those roles would quietly
        //    revoke access every existing manager and cashier has today.
        $labelOnlyRoles = array_keys(array_filter(
            Permissions::rolePermissions(),
            fn (array $permissions) => $permissions === [],
        ));

        $roleIds = DB::table('roles')->whereIn('name', $labelOnlyRoles)->pluck('id', 'name');

        foreach ($roleIds as $roleId) {
            $permissionIds = DB::table('role_has_permissions')->where('role_id', $roleId)->pluck('permission_id');
            $holders = DB::table('model_has_roles')->where('role_id', $roleId)->get();

            foreach ($holders as $holder) {
                foreach ($permissionIds as $permissionId) {
                    DB::table('model_has_permissions')->updateOrInsert([
                        'permission_id' => $permissionId,
                        'model_type' => $holder->model_type,
                        'model_id' => $holder->model_id,
                    ]);
                }
            }
        }

        // 4. Drop the retired permissions and their now-redundant pivots.
        //    Some legacy slugs survive verbatim into the new matrix
        //    (pos.access, reports.view, period-closing.close, ...) — those
        //    are current permissions, not retired ones, and deleting them
        //    here would revoke the very access step 2 just granted.
        $retiredNames = array_diff(array_keys($map), Permissions::all());

        $legacyIds = array_values(array_filter(
            array_map(fn (string $name) => $idsByName[$name] ?? null, $retiredNames),
        ));

        if ($legacyIds !== []) {
            DB::table('role_has_permissions')->whereIn('permission_id', $legacyIds)->delete();
            DB::table('model_has_permissions')->whereIn('permission_id', $legacyIds)->delete();
            DB::table('permissions')->whereIn('id', $legacyIds)->delete();
        }

        app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        // Re-create the coarse permissions and grant one wherever every
        // granular permission it stood for is held.
        $map = Permissions::legacyMap();
        $now = now();

        foreach (array_keys($map) as $name) {
            DB::table('permissions')->updateOrInsert(
                ['name' => $name, 'guard_name' => 'web'],
                ['created_at' => $now, 'updated_at' => $now],
            );
        }

        $idsByName = DB::table('permissions')->where('guard_name', 'web')->pluck('id', 'name');

        foreach ($map as $legacyName => $replacements) {
            $legacyId = $idsByName[$legacyName] ?? null;
            $replacementIds = array_values(array_filter(
                array_map(fn (string $name) => $idsByName[$name] ?? null, $replacements),
            ));

            if ($legacyId === null || $replacementIds === []) {
                continue;
            }

            $roleIds = DB::table('role_has_permissions')
                ->whereIn('permission_id', $replacementIds)
                ->groupBy('role_id')
                ->havingRaw('COUNT(DISTINCT permission_id) = ?', [count($replacementIds)])
                ->pluck('role_id');

            foreach ($roleIds as $roleId) {
                DB::table('role_has_permissions')->updateOrInsert(
                    ['permission_id' => $legacyId, 'role_id' => $roleId],
                );
            }
        }

        $granularIds = array_values(array_filter(
            array_map(fn (string $name) => $idsByName[$name] ?? null, Permissions::all()),
        ));

        if ($granularIds !== []) {
            DB::table('role_has_permissions')->whereIn('permission_id', $granularIds)->delete();
            DB::table('model_has_permissions')->whereIn('permission_id', $granularIds)->delete();
            DB::table('permissions')->whereIn('id', $granularIds)->delete();
        }

        app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
