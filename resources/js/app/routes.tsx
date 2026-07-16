import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '@/app/layout/AppLayout';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { ProductsListPage } from '@/features/products/ProductsListPage';
import { CustomersListPage } from '@/features/customers/CustomersListPage';
import { SuppliersListPage } from '@/features/suppliers/SuppliersListPage';
import { PurchasesListPage } from '@/features/purchases/PurchasesListPage';
import { NewPurchasePage } from '@/features/purchases/NewPurchasePage';
import { PosPage } from '@/features/pos/PosPage';
import { ExpensesPage } from '@/features/expenses/ExpensesPage';
import { EmployeesListPage } from '@/features/employees/EmployeesListPage';
import { PayrollPage } from '@/features/payroll/PayrollPage';
import { PeriodClosingPage } from '@/features/period-closing/PeriodClosingPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export const router = createBrowserRouter([
    { path: '/login', element: <LoginPage /> },
    {
        element: <ProtectedRoute />,
        children: [
            {
                path: '/',
                element: <AppLayout />,
                children: [
                    { index: true, element: <DashboardPage /> },
                    { path: 'pos', element: <PosPage /> },
                    { path: 'products', element: <ProductsListPage /> },
                    { path: 'customers', element: <CustomersListPage /> },
                    { path: 'suppliers', element: <SuppliersListPage /> },
                    { path: 'purchases', element: <PurchasesListPage /> },
                    { path: 'purchases/new', element: <NewPurchasePage /> },
                    { path: 'expenses', element: <ExpensesPage /> },
                    { path: 'employees', element: <EmployeesListPage /> },
                    { path: 'payroll', element: <PayrollPage /> },
                    { path: 'period-closing', element: <PeriodClosingPage /> },
                ],
            },
        ],
    },
]);
