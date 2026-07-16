import { AppBar, Box, Button, Toolbar, Typography } from '@mui/material';
import { Link as RouterLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Can } from '@/components/Can';
import { useAuthStore } from '@/store/authStore';

export function AppLayout() {
    const { t } = useTranslation();
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <AppBar position="static" color="primary">
                <Toolbar sx={{ gap: 2 }}>
                    <Typography variant="h6" sx={{ me: 2 }}>
                        {t('app_name')}
                    </Typography>
                    <Button color="inherit" component={RouterLink} to="/">
                        {t('nav.dashboard')}
                    </Button>
                    <Can permission="pos.access">
                        <Button color="inherit" component={RouterLink} to="/pos">
                            {t('nav.pos')}
                        </Button>
                    </Can>
                    <Can permission="products.manage">
                        <Button color="inherit" component={RouterLink} to="/products">
                            {t('nav.products')}
                        </Button>
                    </Can>
                    <Can permission="sales.manage">
                        <Button color="inherit" component={RouterLink} to="/customers">
                            {t('nav.customers')}
                        </Button>
                    </Can>
                    <Can permission="purchases.manage">
                        <Button color="inherit" component={RouterLink} to="/suppliers">
                            {t('nav.suppliers')}
                        </Button>
                        <Button color="inherit" component={RouterLink} to="/purchases">
                            {t('nav.purchases')}
                        </Button>
                    </Can>
                    <Box sx={{ flexGrow: 1 }} />
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
