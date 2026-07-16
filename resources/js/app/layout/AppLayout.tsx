import { useState } from 'react';
import {
    AppBar,
    Box,
    Divider,
    Drawer,
    IconButton,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Toolbar,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import PeopleIcon from '@mui/icons-material/People';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import BadgeIcon from '@mui/icons-material/Badge';
import PaymentsIcon from '@mui/icons-material/Payments';
import LockClockIcon from '@mui/icons-material/LockClock';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Can } from '@/components/Can';
import { useAuthStore } from '@/store/authStore';

const DRAWER_WIDTH = 240;

interface NavItem {
    to: string;
    labelKey: string;
    icon: React.ReactNode;
    permission?: string;
}

const NAV_ITEMS: NavItem[] = [
    { to: '/', labelKey: 'nav.dashboard', icon: <DashboardIcon /> },
    { to: '/pos', labelKey: 'nav.pos', icon: <PointOfSaleIcon />, permission: 'pos.access' },
    { to: '/products', labelKey: 'nav.products', icon: <Inventory2Icon />, permission: 'products.manage' },
    { to: '/customers', labelKey: 'nav.customers', icon: <PeopleIcon />, permission: 'sales.manage' },
    { to: '/suppliers', labelKey: 'nav.suppliers', icon: <LocalShippingIcon />, permission: 'purchases.manage' },
    { to: '/purchases', labelKey: 'nav.purchases', icon: <ShoppingCartIcon />, permission: 'purchases.manage' },
    { to: '/expenses', labelKey: 'nav.expenses', icon: <PaymentsIcon />, permission: 'expenses.manage' },
    { to: '/employees', labelKey: 'nav.employees', icon: <BadgeIcon />, permission: 'employees.manage' },
    { to: '/payroll', labelKey: 'nav.payroll', icon: <ReceiptLongIcon />, permission: 'payroll.manage' },
    { to: '/period-closing', labelKey: 'nav.period_closing', icon: <LockClockIcon />, permission: 'period-closing.close' },
    { to: '/reports', labelKey: 'nav.reports', icon: <AssessmentIcon />, permission: 'reports.view' },
    { to: '/settings', labelKey: 'nav.settings', icon: <SettingsIcon /> },
];

export function AppLayout() {
    const { t } = useTranslation();
    const theme = useTheme();
    const location = useLocation();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [mobileOpen, setMobileOpen] = useState(false);
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);

    const drawerContent = (
        <Box>
            <Toolbar>
                <Typography variant="h6" noWrap>
                    {t('app_name')}
                </Typography>
            </Toolbar>
            <Divider />
            <List>
                {NAV_ITEMS.map((item) => {
                    const button = (
                        <ListItemButton
                            key={item.to}
                            component={RouterLink}
                            to={item.to}
                            selected={location.pathname === item.to}
                            onClick={() => setMobileOpen(false)}
                        >
                            <ListItemIcon>{item.icon}</ListItemIcon>
                            <ListItemText primary={t(item.labelKey)} />
                        </ListItemButton>
                    );

                    return item.permission ? (
                        <Can key={item.to} permission={item.permission}>
                            {button}
                        </Can>
                    ) : (
                        button
                    );
                })}
            </List>
            <Divider />
            {user && (
                <List>
                    <ListItemButton onClick={() => logout()}>
                        <ListItemIcon>
                            <LogoutIcon />
                        </ListItemIcon>
                        <ListItemText primary={t('actions.logout')} />
                    </ListItemButton>
                </List>
            )}
        </Box>
    );

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
            <AppBar
                position="fixed"
                color="primary"
                sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}
            >
                <Toolbar sx={{ gap: 2 }}>
                    <IconButton
                        color="inherit"
                        edge="start"
                        onClick={() => setMobileOpen((open) => !open)}
                        sx={{ display: { md: 'none' } }}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" noWrap sx={{ display: { xs: 'none', md: 'block' } }}>
                        {t('app_name')}
                    </Typography>
                    <Box sx={{ flexGrow: 1 }} />
                    {user && (
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                            {t('auth.signed_in_as', { name: user.name })}
                        </Typography>
                    )}
                    <LanguageSwitcher />
                </Toolbar>
            </AppBar>

            <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
                <Drawer
                    variant={isMobile ? 'temporary' : 'permanent'}
                    open={isMobile ? mobileOpen : true}
                    onClose={() => setMobileOpen(false)}
                    ModalProps={{ keepMounted: true }}
                    sx={{
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
                    }}
                >
                    {drawerContent}
                </Drawer>
            </Box>

            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 3,
                    width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
                }}
            >
                <Toolbar />
                <Outlet />
            </Box>
        </Box>
    );
}
