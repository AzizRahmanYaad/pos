import { Box, CircularProgress } from '@mui/material';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

export function ProtectedRoute() {
    const status = useAuthStore((state) => state.status);
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

    return <Outlet />;
}
