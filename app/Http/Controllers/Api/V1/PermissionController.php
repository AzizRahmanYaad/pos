<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Users\ResolvesAssignableAccess;
use App\Models\User;
use App\Support\Permissions;
use Illuminate\Http\Request;

class PermissionController extends Controller
{
    use ResolvesAssignableAccess;

    /**
     * Everything the permission screen needs to draw itself: the module
     * matrix, the role presets that pre-tick it, and the ceiling of what
     * this particular admin is allowed to hand out. Serving the matrix
     * from the same manifest the API enforces means the screen can never
     * drift from what the backend actually allows.
     */
    public function index(Request $request)
    {
        $this->authorize('viewAny', User::class);

        $grantable = $request->user()->grantablePermissions();

        $modules = [];
        foreach (Permissions::modules() as $module => $definition) {
            $slugs = array_values(array_filter(
                Permissions::forModule($module),
                fn (string $slug) => in_array($slug, $grantable, true),
            ));

            // A module the admin holds nothing in is not theirs to give
            // away, so it never reaches the screen at all.
            if ($slugs === []) {
                continue;
            }

            $modules[] = [
                'key' => $module,
                'group' => $definition['group'],
                'actions' => array_values(array_map(
                    fn (string $slug) => [
                        'action' => substr($slug, strlen($module) + 1),
                        'permission' => $slug,
                    ],
                    $slugs,
                )),
            ];
        }

        // Only presets for roles this account may actually assign — an
        // admin preset is no use to someone who cannot create an admin.
        $assignableRoles = $this->assignableRoles($request->user());

        $presets = [];
        foreach (Permissions::presets() as $role => $permissions) {
            if (! in_array($role, $assignableRoles, true)) {
                continue;
            }

            $presets[$role] = array_values(array_intersect($permissions, $grantable));
        }

        return response()->json([
            'modules' => $modules,
            'presets' => $presets,
            'grantable' => $grantable,
        ]);
    }
}
