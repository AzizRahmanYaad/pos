<?php

namespace App\Support;

/**
 * The single source of truth for what a user can be allowed to do.
 *
 * Permissions are granular: every module declares the actions that make
 * sense for it, and each pair becomes a `module.action` slug. Keeping the
 * whole matrix here means the seeder, the API enforcement, the permission
 * screen, and the navigation all describe the same thing, so a module can
 * never be visible in one place and unenforced in another.
 */
class Permissions
{
    // Actions. Not every module supports every one — see modules().
    public const VIEW = 'view';

    public const CREATE = 'create';

    public const EDIT = 'edit';

    public const DELETE = 'delete';

    public const PRINT = 'print';

    public const EXPORT = 'export';

    public const APPROVE = 'approve';

    /** POS is all-or-nothing: you either work the till or you don't. */
    public const ACCESS = 'access';

    /** See every user's sales, not just your own. */
    public const VIEW_ALL = 'view-all';

    /** Stock corrections (count adjustments, write-offs). */
    public const ADJUST = 'adjust';

    /** Write off an outstanding party balance. */
    public const CLEAR = 'clear';

    public const CLOSE = 'close';

    public const REOPEN = 'reopen';

    // Modules.
    public const DASHBOARD = 'dashboard';

    public const JOURNAL = 'journal';

    public const POS = 'pos';

    public const SALES = 'sales';

    public const PURCHASES = 'purchases';

    public const PRODUCTS = 'products';

    public const INVENTORY = 'inventory';

    public const CUSTOMERS = 'customers';

    public const SUPPLIERS = 'suppliers';

    public const LEDGER = 'ledger';

    public const PAYMENTS = 'payments';

    public const EXPENSES = 'expenses';

    public const EMPLOYEES = 'employees';

    public const PAYROLL = 'payroll';

    public const PERIOD_CLOSING = 'period-closing';

    public const REPORTS = 'reports';

    public const SETTINGS = 'settings';

    public const USERS = 'users';

    public const COMPANIES = 'companies';

    public const ACTIVITY = 'activity';

    /**
     * Every module, in the order the navigation presents them, with the
     * actions it supports and the navigation group it belongs to. `admin`
     * marks the platform-owner modules a company never sees.
     *
     * @return array<string, array{group:string, actions:string[], admin?:bool}>
     */
    public static function modules(): array
    {
        return [
            self::DASHBOARD => ['group' => 'overview', 'actions' => [self::VIEW]],
            self::JOURNAL => ['group' => 'overview', 'actions' => [self::VIEW, self::PRINT, self::EXPORT]],

            self::POS => ['group' => 'selling', 'actions' => [self::ACCESS]],
            self::SALES => ['group' => 'selling', 'actions' => [self::VIEW, self::VIEW_ALL, self::CREATE, self::DELETE, self::PRINT, self::EXPORT]],
            self::CUSTOMERS => ['group' => 'selling', 'actions' => [self::VIEW, self::CREATE, self::EDIT, self::DELETE, self::PRINT, self::EXPORT]],

            self::PURCHASES => ['group' => 'buying', 'actions' => [self::VIEW, self::CREATE, self::EDIT, self::DELETE, self::APPROVE, self::PRINT, self::EXPORT]],
            self::SUPPLIERS => ['group' => 'buying', 'actions' => [self::VIEW, self::CREATE, self::EDIT, self::DELETE, self::PRINT, self::EXPORT]],

            self::PRODUCTS => ['group' => 'catalogue', 'actions' => [self::VIEW, self::CREATE, self::EDIT, self::DELETE, self::PRINT, self::EXPORT]],
            self::INVENTORY => ['group' => 'catalogue', 'actions' => [self::VIEW, self::ADJUST, self::PRINT, self::EXPORT]],

            self::LEDGER => ['group' => 'money', 'actions' => [self::VIEW, self::CLEAR, self::PRINT, self::EXPORT]],
            self::PAYMENTS => ['group' => 'money', 'actions' => [self::VIEW, self::CREATE]],
            self::EXPENSES => ['group' => 'money', 'actions' => [self::VIEW, self::CREATE, self::DELETE, self::PRINT, self::EXPORT]],

            self::EMPLOYEES => ['group' => 'people', 'actions' => [self::VIEW, self::CREATE, self::EDIT, self::DELETE, self::PRINT, self::EXPORT]],
            self::PAYROLL => ['group' => 'people', 'actions' => [self::VIEW, self::CREATE, self::APPROVE, self::PRINT, self::EXPORT]],

            self::REPORTS => ['group' => 'insight', 'actions' => [self::VIEW, self::PRINT, self::EXPORT]],
            self::PERIOD_CLOSING => ['group' => 'insight', 'actions' => [self::VIEW, self::CLOSE, self::REOPEN]],

            self::USERS => ['group' => 'administration', 'actions' => [self::VIEW, self::CREATE, self::EDIT, self::DELETE]],
            self::SETTINGS => ['group' => 'administration', 'actions' => [self::VIEW, self::EDIT]],
            self::ACTIVITY => ['group' => 'administration', 'actions' => [self::VIEW, self::EXPORT]],

            self::COMPANIES => ['group' => 'platform', 'actions' => [self::VIEW, self::EDIT], 'admin' => true],
        ];
    }

    /** Build the slug for a module/action pair. */
    public static function of(string $module, string $action): string
    {
        return "{$module}.{$action}";
    }

    /**
     * Every permission slug in the system.
     *
     * @return string[]
     */
    public static function all(): array
    {
        $permissions = [];

        foreach (self::modules() as $module => $definition) {
            foreach ($definition['actions'] as $action) {
                $permissions[] = self::of($module, $action);
            }
        }

        return $permissions;
    }

    /**
     * Every slug for one module.
     *
     * @return string[]
     */
    public static function forModule(string $module): array
    {
        $definition = self::modules()[$module] ?? null;

        if ($definition === null) {
            return [];
        }

        return array_map(fn (string $action) => self::of($module, $action), $definition['actions']);
    }

    /**
     * Everything a company may hold — i.e. all permissions except the
     * platform-owner ones. This is exactly what a Company Admin gets, and
     * the ceiling on what they can hand out to their own staff.
     *
     * @return string[]
     */
    public static function forCompany(): array
    {
        $permissions = [];

        foreach (self::modules() as $module => $definition) {
            if ($definition['admin'] ?? false) {
                continue;
            }

            $permissions = [...$permissions, ...self::forModule($module)];
        }

        return $permissions;
    }

    /**
     * The only modules the platform owner ever touches: the businesses on
     * the platform, the accounts inside them, and the trail both leave
     * behind. Everything else in this file is a shop's own trading, which
     * the platform owner has no part in — it sells nothing, buys nothing
     * and banks nothing.
     *
     * This is the list the superadmin role is built from *and* the list
     * ConfinePlatformOwner turns people away at the door with, so the two
     * can never drift apart and leave an endpoint reachable that no screen
     * admits to.
     *
     * @return string[]
     */
    public static function platformOwnerModules(): array
    {
        return [self::COMPANIES, self::USERS, self::ACTIVITY];
    }

    /**
     * Permissions attached to a role. Only the two structural roles carry
     * permissions: the platform superadmin, and the Company Admin who owns
     * everything inside their own business. Staff roles are presets applied
     * in the permission screen (see presets()) rather than sources of
     * authority, so what an admin ticks for a user is exactly what that
     * user gets — unticking something always takes effect.
     *
     * @return array<string, string[]>
     */
    public static function rolePermissions(): array
    {
        return [
            // Owns the platform: businesses, their user limits, and the
            // accounts inside them. Deliberately holds no operational
            // permissions, so it never lands in a company's POS.
            'superadmin' => array_merge(
                ...array_map(fn (string $module) => self::forModule($module), self::platformOwnerModules()),
            ),
            // Owns one business, top to bottom.
            'admin' => self::forCompany(),
            'manager' => [],
            'cashier' => [],
        ];
    }

    /**
     * Starting points offered in the permission screen. Picking one ticks
     * that set of boxes; the admin is free to adjust before saving.
     *
     * @return array<string, string[]>
     */
    public static function presets(): array
    {
        $everyActionFor = fn (array $modules) => array_merge(
            ...array_map(fn (string $module) => self::forModule($module), $modules),
        );

        return [
            'admin' => self::forCompany(),
            'manager' => [
                ...$everyActionFor([
                    self::DASHBOARD, self::JOURNAL, self::POS, self::SALES, self::CUSTOMERS,
                    self::PURCHASES, self::SUPPLIERS, self::PRODUCTS, self::INVENTORY,
                    self::LEDGER, self::PAYMENTS, self::EXPENSES, self::EMPLOYEES,
                    self::PAYROLL, self::REPORTS,
                ]),
                self::of(self::PERIOD_CLOSING, self::VIEW),
                self::of(self::PERIOD_CLOSING, self::CLOSE),
                self::of(self::SETTINGS, self::VIEW),
            ],
            'cashier' => [
                self::of(self::POS, self::ACCESS),
                self::of(self::SALES, self::VIEW),
                self::of(self::SALES, self::CREATE),
                self::of(self::SALES, self::PRINT),
                self::of(self::CUSTOMERS, self::VIEW),
                self::of(self::CUSTOMERS, self::CREATE),
                self::of(self::PRODUCTS, self::VIEW),
            ],
        ];
    }

    /**
     * How the retired coarse permissions map onto the granular ones, used
     * by the migration so existing roles and accounts keep exactly the
     * access they had.
     *
     * @return array<string, string[]>
     */
    public static function legacyMap(): array
    {
        return [
            'pos.access' => [self::of(self::POS, self::ACCESS)],
            'products.manage' => self::forModule(self::PRODUCTS),
            'inventory.manage' => self::forModule(self::INVENTORY),
            'purchases.manage' => [...self::forModule(self::PURCHASES), ...self::forModule(self::SUPPLIERS)],
            'sales.manage' => [...self::forModule(self::SALES), ...self::forModule(self::CUSTOMERS)],
            'sales.view-all' => [self::of(self::SALES, self::VIEW_ALL)],
            'ledger.view' => self::forModule(self::LEDGER),
            'payments.manage' => self::forModule(self::PAYMENTS),
            'expenses.manage' => self::forModule(self::EXPENSES),
            'employees.manage' => self::forModule(self::EMPLOYEES),
            'payroll.manage' => self::forModule(self::PAYROLL),
            'period-closing.close' => [self::of(self::PERIOD_CLOSING, self::VIEW), self::of(self::PERIOD_CLOSING, self::CLOSE)],
            'period-closing.reopen' => [self::of(self::PERIOD_CLOSING, self::REOPEN)],
            'reports.view' => [
                ...self::forModule(self::REPORTS),
                ...self::forModule(self::DASHBOARD),
                ...self::forModule(self::JOURNAL),
            ],
            'settings.manage' => self::forModule(self::SETTINGS),
            'users.manage' => [...self::forModule(self::USERS), ...self::forModule(self::COMPANIES)],
        ];
    }
}
