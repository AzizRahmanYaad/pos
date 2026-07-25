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
import { SalesListPage } from '@/features/sales/SalesListPage';
import { SaleDetailPage } from '@/features/sales/SaleDetailPage';
import { ExpensesPage } from '@/features/expenses/ExpensesPage';
import { EmployeesListPage } from '@/features/employees/EmployeesListPage';
import { EmployeeDetailPage } from '@/features/employees/EmployeeDetailPage';
import { PayrollPage } from '@/features/payroll/PayrollPage';
import { PayrollRunDetailPage } from '@/features/payroll/PayrollRunDetailPage';
import { PeriodClosingPage } from '@/features/period-closing/PeriodClosingPage';
import { PeriodClosingDetailPage } from '@/features/period-closing/PeriodClosingDetailPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { DailyJournalPage } from '@/features/journal/DailyJournalPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { UsersPage } from '@/features/users/UsersPage';
import { PartyLedgerPage } from '@/features/parties/PartyLedgerPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RequirePermission } from '@/components/RequirePermission';
import { useAuthStore } from '@/store/authStore';
import { visibleNavigation } from '@/app/navigation';

/**
 * Sends each user to the dashboard that matches their role: a superadmin
 * (user administration only) lands on the user-management dashboard,
 * everyone else lands on the POS operations dashboard.
 */
function HomeRoute() {
    const can = useAuthStore((state) => state.can);

    if (can('dashboard.view')) {
        return <DashboardPage />;
    }

    // No dashboard: fall through to the first screen this user can open,
    // so nobody ever lands on a page they are only going to be bounced off.
    const fallback = visibleNavigation(can).flatMap((entry) =>
        entry.kind === 'link' ? [entry.to] : entry.children.map((child) => child.to),
    ).find((to) => to !== '/');

    return <Navigate to={fallback ?? '/login'} replace />;
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
                    { path: 'users', element: guarded('users.view', <UsersPage />) },
                    { path: 'pos', element: guarded('pos.access', <PosPage />) },
                    { path: 'sales', element: guarded('sales.view', <SalesListPage />) },
                    { path: 'sales/:id', element: guarded('sales.view', <SaleDetailPage />) },
                    { path: 'products', element: guarded('products.view', <ProductsListPage />) },
                    { path: 'stocks', element: guarded('inventory.view', <StocksPage />) },
                    { path: 'customers', element: guarded('customers.view', <CustomersListPage />) },
                    { path: 'customers/:id/ledger', element: guarded('customers.view', <PartyLedgerPage kind="customer" />) },
                    { path: 'suppliers', element: guarded('suppliers.view', <SuppliersListPage />) },
                    { path: 'suppliers/:id/ledger', element: guarded('suppliers.view', <PartyLedgerPage kind="supplier" />) },
                    { path: 'purchases', element: guarded('purchases.view', <PurchasesListPage />) },
                    { path: 'purchases/new', element: guarded('purchases.create', <NewPurchasePage />) },
                    { path: 'purchases/:id', element: guarded('purchases.view', <PurchaseDetailPage />) },
                    { path: 'expenses', element: guarded('expenses.view', <ExpensesPage />) },
                    { path: 'employees', element: guarded('employees.view', <EmployeesListPage />) },
                    { path: 'employees/:id', element: guarded('employees.view', <EmployeeDetailPage />) },
                    { path: 'payroll', element: guarded('payroll.view', <PayrollPage />) },
                    { path: 'payroll/:id', element: guarded('payroll.view', <PayrollRunDetailPage />) },
                    { path: 'period-closing', element: guarded('period-closing.view', <PeriodClosingPage />) },
                    { path: 'period-closing/:id', element: guarded('period-closing.view', <PeriodClosingDetailPage />) },
                    { path: 'reports', element: guarded('reports.view', <ReportsPage />) },
                    { path: 'journal', element: guarded('journal.view', <DailyJournalPage />) },
                    { path: 'settings', element: guarded('settings.view', <SettingsPage />) },
                ],
            },
        ],
    },
]);
