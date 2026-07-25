<?php

namespace Database\Seeders;

use App\Support\Permissions;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    /**
     * Seed the application's roles and permissions.
     */
    public function run(): void
    {
        foreach (Permissions::all() as $permission) {
            Permission::findOrCreate($permission, 'web');
        }

        // Anything no longer in the manifest is a retired permission; drop
        // it so a renamed module cannot leave a dangling grant behind that
        // still satisfies a stale check somewhere.
        Permission::query()->whereNotIn('name', Permissions::all())->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (Permissions::rolePermissions() as $role => $permissions) {
            Role::findOrCreate($role, 'web')->syncPermissions($permissions);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
