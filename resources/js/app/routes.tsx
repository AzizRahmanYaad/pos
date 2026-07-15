import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '@/app/layout/AppLayout';
import { DashboardPage } from '@/features/dashboard/DashboardPage';

export const router = createBrowserRouter([
    {
        path: '/',
        element: <AppLayout />,
        children: [{ index: true, element: <DashboardPage /> }],
    },
]);
