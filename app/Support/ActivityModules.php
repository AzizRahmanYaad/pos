<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * Which part of the application an action belongs to.
 *
 * Log entries are filed under the same module names the permission matrix
 * and the navigation use, so "show me everything that happened in Purchases"
 * means one thing across the whole system — whether the entry came from a
 * model being saved or from a report being exported.
 */
class ActivityModules
{
    /** Records that are really part of a bigger module. */
    private const MODEL_MODULES = [
        'Product' => Permissions::PRODUCTS,
        'Category' => Permissions::PRODUCTS,
        'Unit' => Permissions::PRODUCTS,
        'Warehouse' => Permissions::INVENTORY,
        'ProductStock' => Permissions::INVENTORY,
        'StockMovement' => Permissions::INVENTORY,
        'Sale' => Permissions::SALES,
        'SaleItem' => Permissions::SALES,
        'SalePayment' => Permissions::SALES,
        'Customer' => Permissions::CUSTOMERS,
        'Purchase' => Permissions::PURCHASES,
        'PurchaseItem' => Permissions::PURCHASES,
        'PurchaseLandedCost' => Permissions::PURCHASES,
        'Supplier' => Permissions::SUPPLIERS,
        'CashAccount' => Permissions::LEDGER,
        'LedgerEntry' => Permissions::LEDGER,
        'Payment' => Permissions::PAYMENTS,
        'Expense' => Permissions::EXPENSES,
        'ExpenseCategory' => Permissions::EXPENSES,
        'Employee' => Permissions::EMPLOYEES,
        'EmployeeAdvance' => Permissions::EMPLOYEES,
        'PayrollRun' => Permissions::PAYROLL,
        'PayrollItem' => Permissions::PAYROLL,
        'PeriodClosing' => Permissions::PERIOD_CLOSING,
        'BusinessSetting' => Permissions::SETTINGS,
        'User' => Permissions::USERS,
        'Tenant' => Permissions::COMPANIES,
    ];

    /**
     * URL segments that do not match their module name. Everything else
     * falls through to the segment itself, which is already right for
     * products, sales, purchases, customers, suppliers and the rest.
     */
    private const PATH_MODULES = [
        'auth' => 'account',
        'activity-log' => Permissions::ACTIVITY,
        'payroll-items' => Permissions::PAYROLL,
        'categories' => Permissions::PRODUCTS,
        'units' => Permissions::PRODUCTS,
        'warehouses' => Permissions::INVENTORY,
        'inventory' => Permissions::INVENTORY,
        'stock-adjustments' => Permissions::INVENTORY,
        'stock-movements' => Permissions::INVENTORY,
        'cash-accounts' => Permissions::LEDGER,
        'expense-categories' => Permissions::EXPENSES,
        'payroll-runs' => Permissions::PAYROLL,
        'period-closings' => Permissions::PERIOD_CLOSING,
        'settings' => Permissions::SETTINGS,
        'tenants' => Permissions::COMPANIES,
        'roles' => Permissions::USERS,
        'permissions' => Permissions::USERS,
    ];

    public static function for(Model $model): string
    {
        return self::MODEL_MODULES[class_basename($model)] ?? Str::plural(Str::kebab(class_basename($model)));
    }

    /**
     * The module an API path belongs to, for actions that never touch a
     * model — exporting a report, signing in, being refused.
     */
    public static function forPath(string $path): string
    {
        $segments = array_values(array_filter(explode('/', trim($path, '/'))));

        // Drop the "api/v1" prefix; what follows names the module.
        while ($segments !== [] && in_array($segments[0], ['api', 'v1'], true)) {
            array_shift($segments);
        }

        $segment = $segments[0] ?? 'other';

        return self::PATH_MODULES[$segment] ?? $segment;
    }
}
