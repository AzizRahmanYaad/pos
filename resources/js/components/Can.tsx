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
