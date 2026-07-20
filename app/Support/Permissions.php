<?php

namespace App\Support;

/**
 * Central manifest of permission slugs used across the app. Keeping them
 * here (rather than scattered as string literals) avoids typos between
 * the seeder and route middleware as new modules are added.
 */
class Permissions
{
    // Superadmin permissions
    public const SUPERADMIN_ACCESS = 'superadmin.access';

    // POS permissions
    public const POS_ACCESS = 'pos.access';

    public const PRODUCTS_MANAGE = 'products.manage';

    public const INVENTORY_MANAGE = 'inventory.manage';

    public const PURCHASES_MANAGE = 'purchases.manage';

    public const SALES_MANAGE = 'sales.manage';

    public const SALES_VIEW_ALL = 'sales.view-all';

    public const LEDGER_VIEW = 'ledger.view';

    public const PAYMENTS_MANAGE = 'payments.manage';

    public const EXPENSES_MANAGE = 'expenses.manage';

    public const EMPLOYEES_MANAGE = 'employees.manage';

    public const PAYROLL_MANAGE = 'payroll.manage';

    public const PERIOD_CLOSING_CLOSE = 'period-closing.close';

    public const PERIOD_CLOSING_REOPEN = 'period-closing.reopen';

    public const REPORTS_VIEW = 'reports.view';

    public const SETTINGS_MANAGE = 'settings.manage';

    public const USERS_MANAGE = 'users.manage';

    /**
     * Get all POS permissions (for admin/manager/cashier roles)
     */
    public static function posPermissions(): array
    {
        return [
            self::POS_ACCESS,
            self::PRODUCTS_MANAGE,
            self::INVENTORY_MANAGE,
            self::PURCHASES_MANAGE,
            self::SALES_MANAGE,
            self::SALES_VIEW_ALL,
            self::LEDGER_VIEW,
            self::PAYMENTS_MANAGE,
            self::EXPENSES_MANAGE,
            self::EMPLOYEES_MANAGE,
            self::PAYROLL_MANAGE,
            self::PERIOD_CLOSING_CLOSE,
            self::PERIOD_CLOSING_REOPEN,
            self::REPORTS_VIEW,
            self::SETTINGS_MANAGE,
            self::USERS_MANAGE,
        ];
    }

    /**
     * @return string[]
     */
    public static function all(): array
    {
        return array_merge([self::SUPERADMIN_ACCESS], self::posPermissions());
    }

    /**
     * @return array<string, string[]>
     */
    public static function rolePermissions(): array
    {
        return [
            'superadmin' => [self::SUPERADMIN_ACCESS],
            'admin' => self::posPermissions(),
            'manager' => [
                self::POS_ACCESS,
                self::PRODUCTS_MANAGE,
                self::INVENTORY_MANAGE,
                self::PURCHASES_MANAGE,
                self::SALES_MANAGE,
                self::SALES_VIEW_ALL,
                self::LEDGER_VIEW,
                self::PAYMENTS_MANAGE,
                self::EXPENSES_MANAGE,
                self::EMPLOYEES_MANAGE,
                self::PAYROLL_MANAGE,
                self::PERIOD_CLOSING_CLOSE,
                self::REPORTS_VIEW,
            ],
            'cashier' => [
                self::POS_ACCESS,
                self::SALES_MANAGE,
            ],
        ];
    }
}
