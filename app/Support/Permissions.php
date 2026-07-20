<?php

namespace App\Support;

/**
 * Simple permission system for 2 roles:
 * - superadmin: manages all POS instances
 * - pos_admin: manages their own POS operations
 */
class Permissions
{
    public const SUPERADMIN_ACCESS = 'superadmin.access';
    public const POS_ACCESS = 'pos.access';

    /**
     * @return array<string, string[]>
     */
    public static function rolePermissions(): array
    {
        return [
            'superadmin' => [self::SUPERADMIN_ACCESS],
            'pos_admin' => [self::POS_ACCESS],
        ];
    }
}
