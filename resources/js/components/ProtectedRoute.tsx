import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { BrandSpinner } from '@/components/BrandSpinner';

export function ProtectedRoute() {
    const { t } = useTranslation();
    const status = useAuthStore((state) => state.status);
    const location = useLocation();

    if (status === 'idle' || status === 'loading') {
        return <BrandSpinner size={72} label={t('common.loading')} fullPage minHeight="100vh" />;
    }

    if (status === 'guest') {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <Outlet />;
}
