import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/app/layout/AppLayout';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { ProductsListPage } from '@/features/products/ProductsListPage';
import { StocksPage } from '@/features/inventory/StocksPage';
import { CustomersListPage } from '@/features/customers/CustomersListPage';
import { SuppliersListPage } from '@/features/suppliers/SuppliersListPage';
import { PurchasesListPage } from '@/features/purchases/PurchasesListPage';
import { NewPurchasePage } from '@/features/purchases/NewPurchasePage';
import { PurchaseDetailPage } from '@/features/purchases/PurchaseDetailPage';
import { PosPage } from '@/features/pos/PosPage';
import { ExpensesPage } from '@/features/expenses/ExpensesPage';
import { EmployeesListPage } from '@/features/employees/EmployeesListPage';
import { EmployeeDetailPage } from '@/features/employees/EmployeeDetailPage';
import { PayrollPage } from '@/features/payroll/PayrollPage';
import { PayrollRunDetailPage } from '@/features/payroll/PayrollRunDetailPage';
import { PeriodClosingPage } from '@/features/period-closing/PeriodClosingPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { UsersPage } from '@/features/users/UsersPage';
import { PartyLedgerPage } from '@/features/parties/PartyLedgerPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RequirePermission } from '@/components/RequirePermission';
import { useAuthStore } from '@/store/authStore';

/**
 * Sends each user to the dashboard that matches their role: a superadmin
 * (user administration only) lands on the user-management dashboard,
 * everyone else lands on the POS operations dashboard.
 */
function HomeRoute() {
    const can = useAuthStore((state) => state.can);

    if (can('users.manage') && !can('pos.access')) {
        return <Navigate to="/users" replace />;
    }

    if (!can('reports.view') && can('pos.access')) {
        return <Navigate to="/pos" replace />;
    }

    return <DashboardPage />;
}

const guarded = (permission: string, element: React.ReactNode) => (
    <RequirePermission permission={permission}>{element}</RequirePermission>
);

export const router = createBrowserRouter([
    { path: '/login', element: <LoginPage /> },
    {
        element: <ProtectedRoute />,
        children: [
            {
                path: '/',
                element: <AppLayout />,
                children: [
                    { index: true, element: <HomeRoute /> },
                    { path: 'users', element: guarded('users.manage', <UsersPage />) },
                    { path: 'pos', element: guarded('pos.access', <PosPage />) },
                    { path: 'products', element: guarded('products.manage', <ProductsListPage />) },
                    { path: 'stocks', element: guarded('inventory.manage', <StocksPage />) },
                    { path: 'customers', element: guarded('sales.manage', <CustomersListPage />) },
                    { path: 'customers/:id/ledger', element: guarded('sales.manage', <PartyLedgerPage kind="customer" />) },
                    { path: 'suppliers', element: guarded('purchases.manage', <SuppliersListPage />) },
                    { path: 'suppliers/:id/ledger', element: guarded('purchases.manage', <PartyLedgerPage kind="supplier" />) },
                    { path: 'purchases', element: guarded('purchases.manage', <PurchasesListPage />) },
                    { path: 'purchases/new', element: guarded('purchases.manage', <NewPurchasePage />) },
                    { path: 'purchases/:id', element: guarded('purchases.manage', <PurchaseDetailPage />) },
                    { path: 'expenses', element: guarded('expenses.manage', <ExpensesPage />) },
                    { path: 'employees', element: guarded('employees.manage', <EmployeesListPage />) },
                    { path: 'employees/:id', element: guarded('employees.manage', <EmployeeDetailPage />) },
                    { path: 'payroll', element: guarded('payroll.manage', <PayrollPage />) },
                    { path: 'payroll/:id', element: guarded('payroll.manage', <PayrollRunDetailPage />) },
                    { path: 'period-closing', element: guarded('period-closing.close', <PeriodClosingPage />) },
                    { path: 'reports', element: guarded('reports.view', <ReportsPage />) },
                    { path: 'settings', element: <SettingsPage /> },
                ],
            },
        ],
    },
]);
