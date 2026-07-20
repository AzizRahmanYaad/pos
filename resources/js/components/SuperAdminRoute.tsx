import { Box, CircularProgress } from '@mui/material';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

interface SuperAdminRouteProps {
    children: React.ReactNode;
}

export function SuperAdminRoute({ children }: SuperAdminRouteProps) {
    const status = useAuthStore((state) => state.status);
    const hasRole = useAuthStore((state) => state.hasRole);
    const location = useLocation();

    if (status === 'idle' || status === 'loading') {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (status === 'guest') {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (!hasRole('superadmin')) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}
