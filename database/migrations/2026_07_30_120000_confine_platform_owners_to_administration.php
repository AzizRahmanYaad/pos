<?php

use App\Models\User;
use App\Support\Permissions;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

/**
 * Takes a shop's permissions off the platform accounts.
 *
 * The superadmin role has only ever carried the administration modules,
 * but a permission can also be granted to an account directly — the
 * permission screen is a grid of tick boxes, and an earlier version of
 * this application handed the platform account a good deal more than it
 * needed. Wherever that happened, the account has been walking around
 * with a shop's permissions on it.
 *
 * The application now refuses those permissions whatever the rows say, so
 * this changes no behaviour. It is here so the database says the same
 * thing the application does, and the permission screen stops showing
 * ticks against an account they mean nothing for.
 *
 * Touches only accounts that own the platform, and only their permissions.
 * No business's data, and no company account, is read or written.
 */
return new class extends Migration
{
    public function up(): void
    {
        $permissions = DB::table('permissions')->pluck('id', 'name');

        $platformOwners = $this->platformOwnerIds($permissions);

        if ($platformOwners === []) {
            return;
        }

        $shopPermissions = $permissions
            ->reject(fn ($id, string $name) => Permissions::belongsToPlatformOwner($name))
            ->values()
            ->all();

        if ($shopPermissions === []) {
            return;
        }

        DB::table('model_has_permissions')
            ->where('model_type', User::class)
            ->whereIn('model_id', $platformOwners)
            ->whereIn('permission_id', $shopPermissions)
            ->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    /**
     * The accounts that own the platform: whoever holds the companies
     * module, directly or through a role.
     *
     * @param  Collection<string, int>  $permissions
     * @return int[]
     */
    private function platformOwnerIds($permissions): array
    {
        $companiesView = $permissions[Permissions::of(Permissions::COMPANIES, Permissions::VIEW)] ?? null;

        if ($companiesView === null) {
            return [];
        }

        $direct = DB::table('model_has_permissions')
            ->where('model_type', User::class)
            ->where('permission_id', $companiesView)
            ->pluck('model_id');

        $roles = DB::table('role_has_permissions')
            ->where('permission_id', $companiesView)
            ->pluck('role_id');

        $viaRole = DB::table('model_has_roles')
            ->where('model_type', User::class)
            ->whereIn('role_id', $roles)
            ->pluck('model_id');

        return $direct->merge($viaRole)->unique()->values()->all();
    }

    /**
     * Deliberately irreversible. What was removed was a grant nobody
     * intended and the application will not honour; putting it back would
     * restore a state the rest of the system does not accept.
     */
    public function down(): void
    {
        //
    }
};
