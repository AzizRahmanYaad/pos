import { useEffect, useState, type MouseEvent } from 'react';
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
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import LockClockOutlinedIcon from '@mui/icons-material/LockClockOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import HighlightOffOutlinedIcon from '@mui/icons-material/HighlightOffOutlined';
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogoMark } from '@/components/AppLogo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Can } from '@/components/Can';
import { useAuthStore } from '@/store/authStore';
import { fetchBusinessSettings } from '@/features/settings/api';
import { fetchStockAlerts } from '@/features/inventory/api';

const DRAWER_WIDTH = 244;
const COLLAPSED_WIDTH = 76;
const COLLAPSE_KEY = 'pos_sidebar_collapsed';

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
    { to: '/sales', labelKey: 'nav.sales', icon: <ReceiptOutlinedIcon />, permission: 'pos.access' },
    { to: '/products', labelKey: 'nav.products', icon: <Inventory2OutlinedIcon />, permission: 'products.manage' },
    { to: '/stocks', labelKey: 'nav.stocks', icon: <WarehouseOutlinedIcon />, permission: 'inventory.manage' },
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
    const navigate = useNavigate();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [mobileOpen, setMobileOpen] = useState(false);
    const [collapsed, setCollapsed] = useState<boolean>(() => localStorage.getItem(COLLAPSE_KEY) === '1');
    const [fullscreen, setFullscreen] = useState(false);
    const [profileEl, setProfileEl] = useState<null | HTMLElement>(null);
    const [notifEl, setNotifEl] = useState<null | HTMLElement>(null);
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);
    const canViewStock = useAuthStore((state) => state.can('inventory.manage'));

    const { data: settings } = useQuery({ queryKey: ['business-settings'], queryFn: fetchBusinessSettings });
    const companyName = settings?.company_name || t('app_name');

    const { data: stockAlerts } = useQuery({
        queryKey: ['stock-alerts'],
        queryFn: fetchStockAlerts,
        enabled: canViewStock,
        refetchInterval: 60_000,
    });
    const alertCount = stockAlerts?.length ?? 0;
    const openNotifications = (e: MouseEvent<HTMLElement>) => setNotifEl(e.currentTarget);
    const closeNotifications = () => setNotifEl(null);

    const openProfile = (e: MouseEvent<HTMLElement>) => setProfileEl(e.currentTarget);
    const closeProfile = () => setProfileEl(null);

    // Persist the collapsed choice and reflect real fullscreen state.
    useEffect(() => {
        localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    }, [collapsed]);

    useEffect(() => {
        const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);

    const toggleFullscreen = () => {
        if (document.fullscreenElement) {
            document.exitFullscreen?.();
        } else {
            document.documentElement.requestFullscreen?.();
        }
    };

    const mini = !isMobile && collapsed;
    const currentWidth = mini ? COLLAPSED_WIDTH : DRAWER_WIDTH;

    const drawerContent = (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: mini ? 'center' : 'flex-start',
                    gap: 1.25,
                    px: mini ? 1 : 2.5,
                    py: 2.25,
                }}
            >
                <LogoMark size={30} />
                {!mini && (
                    <Typography variant="subtitle1" noWrap fontWeight={800} letterSpacing={0.2}>
                        {t('app_name')}
                    </Typography>
                )}
            </Box>

            <List sx={{ px: mini ? 1 : 1.5, py: 0.5, flexGrow: 1 }}>
                {NAV_ITEMS.map((item) => {
                    const selected = location.pathname === item.to;
                    const button = (
                        <Tooltip key={item.to} title={mini ? t(item.labelKey) : ''} placement="right" arrow>
                            <ListItemButton
                                component={RouterLink}
                                to={item.to}
                                selected={selected}
                                onClick={() => setMobileOpen(false)}
                                sx={{ py: 0.85, justifyContent: mini ? 'center' : 'flex-start', px: mini ? 1.25 : 2 }}
                            >
                                <ListItemIcon
                                    sx={{
                                        minWidth: mini ? 0 : 34,
                                        justifyContent: 'center',
                                        color: selected ? 'primary.dark' : 'text.secondary',
                                    }}
                                >
                                    {item.icon}
                                </ListItemIcon>
                                {!mini && (
                                    <ListItemText
                                        primary={t(item.labelKey)}
                                        primaryTypographyProps={{
                                            fontSize: 14,
                                            fontWeight: selected ? 700 : 500,
                                            color: selected ? 'text.primary' : 'text.secondary',
                                        }}
                                    />
                                )}
                            </ListItemButton>
                        </Tooltip>
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
                    width: { md: `calc(100% - ${currentWidth}px)` },
                    ml: { md: `${currentWidth}px` },
                    transition: theme.transitions.create(['width', 'margin'], {
                        easing: theme.transitions.easing.sharp,
                        duration: theme.transitions.duration.enteringScreen,
                    }),
                }}
            >
                <Toolbar sx={{ gap: 1 }}>
                    <Tooltip title={mini ? t('nav_header.expand_menu') : t('nav_header.collapse_menu')}>
                        <IconButton
                            edge="start"
                            onClick={() => (isMobile ? setMobileOpen((open) => !open) : setCollapsed((c) => !c))}
                        >
                            {mini ? <MenuIcon /> : <MenuOpenIcon />}
                        </IconButton>
                    </Tooltip>
                    <Typography variant="h6" noWrap fontWeight={700} sx={{ color: 'text.primary' }}>
                        {companyName}
                    </Typography>
                    <Box sx={{ flexGrow: 1 }} />

                    <Tooltip title={fullscreen ? t('nav_header.exit_fullscreen') : t('nav_header.fullscreen')}>
                        <IconButton size="small" onClick={toggleFullscreen} sx={{ color: 'text.secondary' }}>
                            {fullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t('nav_header.messages')}>
                        <IconButton size="small" sx={{ color: 'text.secondary' }}>
                            <MailOutlineIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t('nav_header.notifications')}>
                        <IconButton size="small" onClick={openNotifications} sx={{ color: 'text.secondary' }}>
                            <Badge badgeContent={alertCount} color="error" max={99}>
                                <NotificationsNoneOutlinedIcon fontSize="small" />
                            </Badge>
                        </IconButton>
                    </Tooltip>
                    <Menu
                        anchorEl={notifEl}
                        open={Boolean(notifEl)}
                        onClose={closeNotifications}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                        PaperProps={{ sx: { width: 340, maxHeight: 420 } }}
                    >
                        <Box sx={{ px: 2, py: 1.25 }}>
                            <Typography variant="subtitle2" fontWeight={700}>
                                {t('nav_header.stock_alerts')}
                            </Typography>
                        </Box>
                        <Divider />
                        {!canViewStock || alertCount === 0 ? (
                            <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
                                <Typography variant="body2" color="text.secondary">
                                    {t('nav_header.no_alerts')}
                                </Typography>
                            </Box>
                        ) : (
                            <>
                                {stockAlerts?.map((alert) => (
                                    <MenuItem
                                        key={alert.id}
                                        onClick={() => {
                                            closeNotifications();
                                            navigate('/stocks');
                                        }}
                                        sx={{ whiteSpace: 'normal', alignItems: 'flex-start', py: 1 }}
                                    >
                                        <ListItemIcon sx={{ mt: 0.25 }}>
                                            {alert.status === 'out' ? (
                                                <HighlightOffOutlinedIcon fontSize="small" color="error" />
                                            ) : (
                                                <ReportProblemOutlinedIcon fontSize="small" color="warning" />
                                            )}
                                        </ListItemIcon>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography variant="body2" fontWeight={600} noWrap>
                                                {alert.name}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {alert.status === 'out'
                                                    ? t('nav_header.out_of_stock_alert')
                                                    : t('nav_header.low_stock_alert', {
                                                          qty: alert.total_stock,
                                                          reorder: alert.reorder_level,
                                                      })}
                                            </Typography>
                                        </Box>
                                    </MenuItem>
                                ))}
                                <Divider />
                                <MenuItem
                                    onClick={() => {
                                        closeNotifications();
                                        navigate('/stocks');
                                    }}
                                    sx={{ justifyContent: 'center', color: 'primary.main', fontWeight: 600 }}
                                >
                                    {t('nav_header.view_all_stock')}
                                </MenuItem>
                            </>
                        )}
                    </Menu>

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

            <Box component="nav" sx={{ width: { md: currentWidth }, flexShrink: { md: 0 } }}>
                <Drawer
                    variant={isMobile ? 'temporary' : 'permanent'}
                    open={isMobile ? mobileOpen : true}
                    onClose={() => setMobileOpen(false)}
                    ModalProps={{ keepMounted: true }}
                    sx={{
                        '& .MuiDrawer-paper': {
                            boxSizing: 'border-box',
                            width: isMobile ? DRAWER_WIDTH : currentWidth,
                            overflowX: 'hidden',
                            transition: theme.transitions.create('width', {
                                easing: theme.transitions.easing.sharp,
                                duration: theme.transitions.duration.enteringScreen,
                            }),
                        },
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
                    width: { md: `calc(100% - ${currentWidth}px)` },
                    transition: theme.transitions.create('width', {
                        easing: theme.transitions.easing.sharp,
                        duration: theme.transitions.duration.enteringScreen,
                    }),
                }}
            >
                <Toolbar />
                <Outlet />
            </Box>
        </Box>
    );
}
