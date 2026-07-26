import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import LockClockOutlinedIcon from '@mui/icons-material/LockClockOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import type { ReactNode } from 'react';

export interface NavLink {
    kind: 'link';
    to: string;
    labelKey: string;
    icon: ReactNode;
    /** Hidden entirely unless the signed-in user holds this. */
    permission: string;
}

export interface NavGroup {
    kind: 'group';
    id: string;
    labelKey: string;
    icon: ReactNode;
    children: NavLink[];
}

export type NavEntry = NavLink | NavGroup;

const link = (to: string, labelKey: string, icon: ReactNode, permission: string): NavLink => ({
    kind: 'link',
    to,
    labelKey,
    icon,
    permission,
});

/**
 * The sidebar, ordered the way a shop actually works through its day:
 * what happened today first, then selling, then buying and the stock that
 * feeds it, then money, people, and finally the administrative screens
 * nobody opens twice a day.
 *
 * The Daily Journal sits near the top on purpose — it is one of the most
 * frequently opened screens, so it should never be buried in a group.
 *
 * Point of Sale is intentionally *also* in the header (see AppLayout), as
 * the primary action of the whole application.
 */
export const NAVIGATION: NavEntry[] = [
    link('/', 'nav.dashboard', <DashboardOutlinedIcon />, 'dashboard.view'),
    link('/journal', 'nav.journal', <MenuBookOutlinedIcon />, 'journal.view'),

    {
        kind: 'group',
        id: 'selling',
        labelKey: 'nav_group.selling',
        icon: <SellOutlinedIcon />,
        children: [
            link('/pos', 'nav.pos', <PointOfSaleOutlinedIcon />, 'pos.access'),
            link('/sales', 'nav.sales', <ReceiptOutlinedIcon />, 'sales.view'),
            link('/customers', 'nav.customers', <PeopleOutlineIcon />, 'customers.view'),
        ],
    },
    {
        kind: 'group',
        id: 'buying',
        labelKey: 'nav_group.buying',
        icon: <ShoppingBagOutlinedIcon />,
        children: [
            link('/purchases', 'nav.purchases', <ShoppingCartOutlinedIcon />, 'purchases.view'),
            link('/suppliers', 'nav.suppliers', <LocalShippingOutlinedIcon />, 'suppliers.view'),
        ],
    },
    {
        kind: 'group',
        id: 'catalogue',
        labelKey: 'nav_group.catalogue',
        icon: <Inventory2Icon />,
        children: [
            link('/products', 'nav.products', <Inventory2OutlinedIcon />, 'products.view'),
            link('/stocks', 'nav.stocks', <WarehouseOutlinedIcon />, 'inventory.view'),
        ],
    },
    {
        kind: 'group',
        id: 'money',
        labelKey: 'nav_group.money',
        icon: <AccountBalanceWalletOutlinedIcon />,
        children: [
            link('/expenses', 'nav.expenses', <PaymentsOutlinedIcon />, 'expenses.view'),
            link('/period-closing', 'nav.period_closing', <LockClockOutlinedIcon />, 'period-closing.view'),
        ],
    },
    {
        kind: 'group',
        id: 'people',
        labelKey: 'nav_group.people',
        icon: <GroupsOutlinedIcon />,
        children: [
            link('/employees', 'nav.employees', <BadgeOutlinedIcon />, 'employees.view'),
            link('/payroll', 'nav.payroll', <ReceiptLongOutlinedIcon />, 'payroll.view'),
        ],
    },

    link('/reports', 'nav.reports', <AssessmentOutlinedIcon />, 'reports.view'),

    {
        kind: 'group',
        id: 'administration',
        labelKey: 'nav_group.administration',
        icon: <AdminPanelSettingsOutlinedIcon />,
        children: [
            link('/users', 'nav.users', <ManageAccountsOutlinedIcon />, 'users.view'),
            link('/activity-log', 'nav.activity_log', <HistoryOutlinedIcon />, 'activity.view'),
            link('/settings', 'nav.settings', <SettingsOutlinedIcon />, 'settings.view'),
        ],
    },
];

/**
 * Drop everything the user cannot reach. A group whose every child is
 * hidden disappears with them, so nobody is left staring at an empty
 * heading that hints at features they do not have.
 */
export function visibleNavigation(can: (permission: string) => boolean): NavEntry[] {
    return NAVIGATION.reduce<NavEntry[]>((entries, entry) => {
        if (entry.kind === 'link') {
            return can(entry.permission) ? [...entries, entry] : entries;
        }

        const children = entry.children.filter((child) => can(child.permission));

        return children.length > 0 ? [...entries, { ...entry, children }] : entries;
    }, []);
}
