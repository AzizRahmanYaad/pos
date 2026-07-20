import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Box, CircularProgress } from '@mui/material';

interface RoleBasedRedirectProps {
    children: React.ReactNode;
}

export function RoleBasedRedirect({ children }: RoleBasedRedirectProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const user = useAuthStore((state) => state.user);
    const status = useAuthStore((state) => state.status);

    useEffect(() => {
        if (status === 'authenticated' && user) {
            // If superadmin is on regular dashboard, redirect to superadmin dashboard
            if (user.roles.includes('superadmin') && location.pathname === '/') {
                navigate('/superadmin', { replace: true });
            }
            // If pos_admin/regular user is on superadmin dashboard, redirect to home
            else if (!user.roles.includes('superadmin') && location.pathname === '/superadmin') {
                navigate('/', { replace: true });
            }
        }
    }, [user, status, location.pathname, navigate]);

    // Show loading while auth status is being determined
    if (status === 'idle' || status === 'loading') {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    return <>{children}</>;
}
