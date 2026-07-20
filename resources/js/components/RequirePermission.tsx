import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

interface RequirePermissionProps {
    permission: string;
    children: ReactNode;
}

/**
 * Route-level guard: renders the page only when the signed-in user holds
 * the permission, otherwise bounces back to their home route. Keeps a
 * superadmin out of POS operation pages and POS staff out of the admin
 * dashboard even when navigating by URL.
 */
export function RequirePermission({ permission, children }: RequirePermissionProps) {
    const allowed = useAuthStore((state) => state.can(permission));

    return allowed ? <>{children}</> : <Navigate to="/" replace />;
}
