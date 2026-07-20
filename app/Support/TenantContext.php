<?php

namespace App\Support;

use Illuminate\Support\Facades\Auth;

/**
 * Resolves the tenant (business) whose data the current execution is
 * allowed to touch. Normally that is the authenticated user's tenant;
 * console jobs iterate tenants explicitly via run().
 */
class TenantContext
{
    private static ?int $override = null;

    public static function id(): ?int
    {
        return self::$override ?? Auth::user()?->tenant_id;
    }

    /**
     * Run a callback with the tenant scope forced to the given tenant.
     */
    public static function run(?int $tenantId, callable $callback): mixed
    {
        $previous = self::$override;
        self::$override = $tenantId;

        try {
            return $callback();
        } finally {
            self::$override = $previous;
        }
    }
}
