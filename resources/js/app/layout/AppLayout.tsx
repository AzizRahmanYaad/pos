import { useState, type MouseEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    AppBar,
    Avatar,
    Badge,
    Box,
    Divider,
    Drawer,
    IconButton,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Toolbar,
    Tooltip,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import LockClockOutlinedIcon from '@mui/icons-material/LockClockOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogoMark } from '@/components/AppLogo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Can } from '@/components/Can';
import { useAuthStore } from '@/store/authStore';
import { fetchBusinessSettings } from '@/features/settings/api';

const DRAWER_WIDTH = 244;

interface NavItem {
    to: string;
    labelKey: string;
    icon: React.ReactNode;
    permission?: string;
}

const NAV_ITEMS: NavItem[] = [
    { to: '/', labelKey: 'nav.dashboard', icon: <DashboardOutlinedIcon />, permission: 'reports.view' },
    { to: '/users', labelKey: 'nav.users', icon: <ManageAccountsOutlinedIcon />, permission: 'users.manage' },
    { to: '/pos', labelKey: 'nav.pos', icon: <PointOfSaleOutlinedIcon />, permission: 'pos.access' },
    { to: '/products', labelKey: 'nav.products', icon: <Inventory2OutlinedIcon />, permission: 'products.manage' },
    { to: '/customers', labelKey: 'nav.customers', icon: <PeopleOutlineIcon />, permission: 'sales.manage' },
    { to: '/suppliers', labelKey: 'nav.suppliers', icon: <LocalShippingOutlinedIcon />, permission: 'purchases.manage' },
    { to: '/purchases', labelKey: 'nav.purchases', icon: <ShoppingCartOutlinedIcon />, permission: 'purchases.manage' },
    { to: '/expenses', labelKey: 'nav.expenses', icon: <PaymentsOutlinedIcon />, permission: 'expenses.manage' },
    { to: '/employees', labelKey: 'nav.employees', icon: <BadgeOutlinedIcon />, permission: 'employees.manage' },
    { to: '/payroll', labelKey: 'nav.payroll', icon: <ReceiptLongOutlinedIcon />, permission: 'payroll.manage' },
    { to: '/period-closing', labelKey: 'nav.period_closing', icon: <LockClockOutlinedIcon />, permission: 'period-closing.close' },
    { to: '/reports', labelKey: 'nav.reports', icon: <AssessmentOutlinedIcon />, permission: 'reports.view' },
    { to: '/settings', labelKey: 'nav.settings', icon: <SettingsOutlinedIcon /> },
];

function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase();
}

export function AppLayout() {
    const { t } = useTranslation();
    const theme = useTheme();
    const location = useLocation();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [mobileOpen, setMobileOpen] = useState(false);
    const [profileEl, setProfileEl] = useState<null | HTMLElement>(null);
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);

    const { data: settings } = useQuery({ queryKey: ['business-settings'], queryFn: fetchBusinessSettings });
    const companyName = settings?.company_name || t('app_name');

    const openProfile = (e: MouseEvent<HTMLElement>) => setProfileEl(e.currentTarget);
    const closeProfile = () => setProfileEl(null);

    const drawerContent = (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2.5, py: 2.25 }}>
                <LogoMark size={30} />
                <Typography variant="subtitle1" noWrap fontWeight={800} letterSpacing={0.2}>
                    {t('app_name')}
                </Typography>
            </Box>

            <List sx={{ px: 1.5, py: 0.5, flexGrow: 1 }}>
                {NAV_ITEMS.map((item) => {
                    const selected = location.pathname === item.to;
                    const button = (
                        <ListItemButton
                            key={item.to}
                            component={RouterLink}
                            to={item.to}
                            selected={selected}
                            onClick={() => setMobileOpen(false)}
                            sx={{ py: 0.85 }}
                        >
                            <ListItemIcon
                                sx={{
                                    minWidth: 34,
                                    color: selected ? 'primary.dark' : 'text.secondary',
                                }}
                            >
                                {item.icon}
                            </ListItemIcon>
                            <ListItemText
                                primary={t(item.labelKey)}
                                primaryTypographyProps={{
                                    fontSize: 14,
                                    fontWeight: selected ? 700 : 500,
                                    color: selected ? 'text.primary' : 'text.secondary',
                                }}
                            />
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
        </Box>
    );

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
            <AppBar
                position="fixed"
                sx={{
                    width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
                    ml: { md: `${DRAWER_WIDTH}px` },
                }}
            >
                <Toolbar sx={{ gap: 1 }}>
                    <IconButton
                        edge="start"
                        onClick={() => setMobileOpen((open) => !open)}
                        sx={{ display: { md: 'none' } }}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" noWrap fontWeight={700} sx={{ color: 'text.primary' }}>
                        {companyName}
                    </Typography>
                    <Box sx={{ flexGrow: 1 }} />

                    <Tooltip title={t('nav_header.messages')}>
                        <IconButton size="small" sx={{ color: 'text.secondary' }}>
                            <MailOutlineIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t('nav_header.notifications')}>
                        <IconButton size="small" sx={{ color: 'text.secondary' }}>
                            <Badge badgeContent={0} color="primary" showZero>
                                <NotificationsNoneOutlinedIcon fontSize="small" />
                            </Badge>
                        </IconButton>
                    </Tooltip>

                    <LanguageSwitcher />

                    {user && (
                        <>
                            <IconButton onClick={openProfile} size="small" sx={{ ml: 0.5 }}>
                                <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: 14 }}>
                                    {initials(user.name)}
                                </Avatar>
                            </IconButton>
                            <Menu
                                anchorEl={profileEl}
                                open={Boolean(profileEl)}
                                onClose={closeProfile}
                                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                            >
                                <Box sx={{ px: 2, py: 1 }}>
                                    <Typography variant="body2" fontWeight={700}>
                                        {user.name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {user.email}
                                    </Typography>
                                </Box>
                                <Divider />
                                <MenuItem component={RouterLink} to="/settings" onClick={closeProfile}>
                                    <ListItemIcon>
                                        <SettingsOutlinedIcon fontSize="small" />
                                    </ListItemIcon>
                                    {t('nav.settings')}
                                </MenuItem>
                                <MenuItem
                                    onClick={() => {
                                        closeProfile();
                                        logout();
                                    }}
                                >
                                    <ListItemIcon>
                                        <LogoutIcon fontSize="small" />
                                    </ListItemIcon>
                                    {t('actions.logout')}
                                </MenuItem>
                            </Menu>
                        </>
                    )}
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
                    p: { xs: 2, md: 3 },
                    width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
                }}
            >
                <Toolbar />
                <Outlet />
            </Box>
        </Box>
    );
}
