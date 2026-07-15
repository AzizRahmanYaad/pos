import { AppBar, Box, Toolbar, Typography } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export function AppLayout() {
    const { t } = useTranslation();

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <AppBar position="static" color="primary">
                <Toolbar sx={{ gap: 2 }}>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        {t('app_name')}
                    </Typography>
                    <LanguageSwitcher />
                </Toolbar>
            </AppBar>
            <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
                <Outlet />
            </Box>
        </Box>
    );
}
