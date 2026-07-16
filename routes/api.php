<?php

use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\BusinessSettingController;
use App\Http\Controllers\Api\V1\CashAccountController;
use App\Http\Controllers\Api\V1\CategoryController;
use App\Http\Controllers\Api\V1\CustomerController;
use App\Http\Controllers\Api\V1\ProductController;
use App\Http\Controllers\Api\V1\PurchaseController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\StockAdjustmentController;
use App\Http\Controllers\Api\V1\StockMovementController;
use App\Http\Controllers\Api\V1\SupplierController;
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
        Route::apiResource('users', UserController::class);

        Route::apiResource('categories', CategoryController::class);
        Route::apiResource('units', UnitController::class);
        Route::apiResource('warehouses', WarehouseController::class);
        Route::apiResource('products', ProductController::class);

        Route::get('/stock-movements', [StockMovementController::class, 'index']);
        Route::post('/stock-adjustments', [StockAdjustmentController::class, 'store']);

        Route::get('/customers/{customer}/ledger', [CustomerController::class, 'ledger']);
        Route::apiResource('customers', CustomerController::class);

        Route::get('/suppliers/{supplier}/ledger', [SupplierController::class, 'ledger']);
        Route::apiResource('suppliers', SupplierController::class);

        Route::apiResource('cash-accounts', CashAccountController::class);

        Route::post('/purchases/{purchase}/receive', [PurchaseController::class, 'receive']);
        Route::post('/purchases/{purchase}/cancel', [PurchaseController::class, 'cancel']);
        Route::apiResource('purchases', PurchaseController::class)->except(['update']);
    });
});
