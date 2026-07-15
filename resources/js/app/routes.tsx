import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '@/app/layout/AppLayout';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export const router = createBrowserRouter([
    { path: '/login', element: <LoginPage /> },
    {
        element: <ProtectedRoute />,
        children: [
            {
                path: '/',
                element: <AppLayout />,
                children: [{ index: true, element: <DashboardPage /> }],
            },
        ],
    },
]);
