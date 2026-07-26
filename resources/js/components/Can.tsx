import type { ReactNode } from 'react';
import { useAuthStore } from '@/store/authStore';

interface CanProps {
    permission: string;
    children: ReactNode;
    fallback?: ReactNode;
}

export function Can({ permission, children, fallback = null }: CanProps) {
    const allowed = useAuthStore((state) => state.can(permission));

    return allowed ? <>{children}</> : <>{fallback}</>;
}

interface CanAnyProps {
    permissions: string[];
    children: ReactNode;
    fallback?: ReactNode;
}

/**
 * Renders when the user holds at least one of these. Used for containers —
 * an actions column, a toolbar — that should appear as soon as any one of
 * the controls inside it is available.
 */
export function CanAny({ permissions, children, fallback = null }: CanAnyProps) {
    const allowed = useAuthStore((state) => state.canAny(permissions));

    return allowed ? <>{children}</> : <>{fallback}</>;
}
