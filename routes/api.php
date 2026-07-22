<?php

use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\BusinessSettingController;
use App\Http\Controllers\Api\V1\CashAccountController;
use App\Http\Controllers\Api\V1\CategoryController;
use App\Http\Controllers\Api\V1\CustomerController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\EmployeeController;
use App\Http\Controllers\Api\V1\ExpenseCategoryController;
use App\Http\Controllers\Api\V1\ExpenseController;
use App\Http\Controllers\Api\V1\PaymentController;
use App\Http\Controllers\Api\V1\PayrollRunController;
use App\Http\Controllers\Api\V1\PeriodClosingController;
use App\Http\Controllers\Api\V1\ProductController;
use App\Http\Controllers\Api\V1\PurchaseController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\SaleController;
use App\Http\Controllers\Api\V1\StockAdjustmentController;
use App\Http\Controllers\Api\V1\StockController;
use App\Http\Controllers\Api\V1\StockMovementController;
use App\Http\Controllers\Api\V1\SupplierController;
use App\Http\Controllers\Api\V1\TenantController;
use App\Http\Controllers\Api\V1\UnitController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\WarehouseController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::put('/auth/password', [AuthController::class, 'updatePassword']);

        Route::get('/settings', [BusinessSettingController::class, 'show']);
        Route::put('/settings', [BusinessSettingController::class, 'update']);

        Route::get('/roles', [RoleController::class, 'index']);
        Route::get('/tenants', [TenantController::class, 'index']);
        Route::post('/users/{user}/extend', [UserController::class, 'extend']);
        Route::apiResource('users', UserController::class);

        Route::apiResource('categories', CategoryController::class);
        Route::apiResource('units', UnitController::class);
        Route::apiResource('warehouses', WarehouseController::class);
        Route::get('/products/report/pdf', [ProductController::class, 'listPdf']);
        Route::apiResource('products', ProductController::class);

        Route::get('/stock-movements', [StockMovementController::class, 'index']);
        Route::post('/stock-adjustments', [StockAdjustmentController::class, 'store']);
        Route::get('/inventory/stock', [StockController::class, 'index']);
        Route::get('/inventory/stock/summary', [StockController::class, 'summary']);
        Route::get('/inventory/stock/alerts', [StockController::class, 'alerts']);

        Route::get('/customers/summary', [CustomerController::class, 'summary']);
        Route::get('/customers/report/pdf', [CustomerController::class, 'listPdf']);
        Route::get('/customers/{customer}/ledger', [CustomerController::class, 'ledger']);
        Route::get('/customers/{customer}/ledger/pdf', [CustomerController::class, 'ledgerPdf']);
        Route::post('/customers/{customer}/ledger/clear', [CustomerController::class, 'clearLedger']);
        Route::apiResource('customers', CustomerController::class);

        Route::get('/suppliers/summary', [SupplierController::class, 'summary']);
        Route::get('/suppliers/{supplier}/ledger', [SupplierController::class, 'ledger']);
        Route::get('/suppliers/{supplier}/ledger/pdf', [SupplierController::class, 'ledgerPdf']);
        Route::post('/suppliers/{supplier}/ledger/clear', [SupplierController::class, 'clearLedger']);
        Route::apiResource('suppliers', SupplierController::class);

        Route::apiResource('cash-accounts', CashAccountController::class);

        Route::get('/purchases/{purchase}/pdf', [PurchaseController::class, 'invoicePdf']);
        Route::post('/purchases/{purchase}/receive', [PurchaseController::class, 'receive']);
        Route::post('/purchases/{purchase}/cancel', [PurchaseController::class, 'cancel']);
        Route::apiResource('purchases', PurchaseController::class)->except(['update']);

        Route::post('/sales/{sale}/refund', [SaleController::class, 'refund']);
        Route::apiResource('sales', SaleController::class)->only(['index', 'store', 'show']);

        Route::apiResource('payments', PaymentController::class)->only(['index', 'store']);

        Route::apiResource('expense-categories', ExpenseCategoryController::class)->only(['index', 'store', 'destroy']);
        Route::get('/expenses/summary', [ExpenseController::class, 'summary']);
        Route::get('/expenses/report/pdf', [ExpenseController::class, 'reportPdf']);
        Route::apiResource('expenses', ExpenseController::class)->only(['index', 'store', 'destroy']);

        Route::get('/employees/{employee}/ledger', [EmployeeController::class, 'ledger']);
        Route::get('/employees/{employee}/pdf', [EmployeeController::class, 'statementPdf']);
        Route::post('/employees/{employee}/advances', [EmployeeController::class, 'storeAdvance']);
        Route::apiResource('employees', EmployeeController::class);

        Route::put('/payroll-items/{payrollItem}', [PayrollRunController::class, 'updateItem']);
        Route::get('/payroll-runs/{payrollRun}/pdf', [PayrollRunController::class, 'reportPdf']);
        Route::post('/payroll-runs/{payrollRun}/pay', [PayrollRunController::class, 'pay']);
        Route::apiResource('payroll-runs', PayrollRunController::class)->only(['index', 'store', 'show']);

        Route::post('/period-closings/{periodClosing}/reopen', [PeriodClosingController::class, 'reopen']);
        Route::apiResource('period-closings', PeriodClosingController::class)->only(['index', 'store', 'show']);

        Route::middleware('permission:reports.view')->group(function () {
            Route::get('/dashboard/summary', [DashboardController::class, 'summary']);
            Route::get('/reports/profit-loss', [ReportController::class, 'profitLoss']);
            Route::get('/reports/profit-loss/pdf', [ReportController::class, 'profitLossPdf']);
            Route::get('/reports/inventory-valuation', [ReportController::class, 'inventoryValuation']);
            Route::get('/reports/inventory-valuation/pdf', [ReportController::class, 'inventoryValuationPdf']);
            Route::get('/reports/sales-summary', [ReportController::class, 'salesSummary']);
            Route::get('/reports/sales-summary/pdf', [ReportController::class, 'salesSummaryPdf']);
            Route::get('/reports/expenses-by-category', [ReportController::class, 'expensesByCategory']);
            Route::get('/reports/expenses-by-category/pdf', [ReportController::class, 'expensesByCategoryPdf']);
            Route::get('/reports/receivables', [ReportController::class, 'receivables']);
            Route::get('/reports/receivables/pdf', [ReportController::class, 'receivablesPdf']);
            Route::get('/reports/payables', [ReportController::class, 'payables']);
            Route::get('/reports/payables/pdf', [ReportController::class, 'payablesPdf']);
        });
    });
});
