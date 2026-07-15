import { AppBar, Box, Button, Toolbar, Typography } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useAuthStore } from '@/store/authStore';

export function AppLayout() {
    const { t } = useTranslation();
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <AppBar position="static" color="primary">
                <Toolbar sx={{ gap: 2 }}>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        {t('app_name')}
                    </Typography>
                    {user && (
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                            {t('auth.signed_in_as', { name: user.name })}
                        </Typography>
                    )}
                    <LanguageSwitcher />
                    {user && (
                        <Button color="inherit" onClick={() => logout()}>
                            {t('actions.logout')}
                        </Button>
                    )}
                </Toolbar>
            </AppBar>
            <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
                <Outlet />
            </Box>
        </Box>
    );
}
