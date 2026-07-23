import { useQuery } from '@tanstack/react-query';
import {
    Avatar,
    Box,
    Chip,
    Grid,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import CallReceivedIcon from '@mui/icons-material/CallReceived';
import CallMadeIcon from '@mui/icons-material/CallMade';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { useTranslation } from 'react-i18next';
import {
    Area,
    AreaChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { fetchDashboardSummary } from '@/features/reports/api';
import { fetchSalesSummary, fetchExpensesByCategory } from '@/features/reports/api';
import { formatDate } from '@/lib/calendar';
import { GOLD, GOLD_DARK, GOLD_RAMP } from '@/theme/theme';

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    accent?: boolean;
}

function StatCard({ icon, label, value, accent }: StatCardProps) {
    return (
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Avatar
                    variant="rounded"
                    sx={{
                        width: 38,
                        height: 38,
                        bgcolor: (th) => alpha(th.palette.primary.main, 0.12),
                        color: 'primary.dark',
                    }}
                >
                    {icon}
                </Avatar>
                <Avatar
                    variant="rounded"
                    sx={{
                        width: 26,
                        height: 26,
                        bgcolor: (th) => alpha(th.palette.primary.main, 0.12),
                        color: 'primary.dark',
                    }}
                >
                    <TrendingUpIcon sx={{ fontSize: 15 }} />
                </Avatar>
            </Stack>
            <Typography
                variant="h5"
                fontWeight={800}
                sx={{ mt: 1.5, color: accent ? 'primary.dark' : 'text.primary' }}
            >
                {value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
                {label}
            </Typography>
        </Paper>
    );
}

export function DashboardPage() {
    const { t, i18n } = useTranslation();

    const { data: summary } = useQuery({ queryKey: ['dashboard-summary'], queryFn: fetchDashboardSummary });

    const from = new Date();
    from.setDate(from.getDate() - 13);
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = new Date().toISOString().slice(0, 10);

    const { data: salesTrend } = useQuery({
        queryKey: ['sales-summary', fromStr, toStr],
        queryFn: () => fetchSalesSummary(fromStr, toStr, 'day'),
    });

    const monthStart = new Date();
    monthStart.setDate(1);
    const { data: expenseBreakdown } = useQuery({
        queryKey: ['expenses-by-category', monthStart.toISOString().slice(0, 10), toStr],
        queryFn: () => fetchExpensesByCategory(monthStart.toISOString().slice(0, 10), toStr),
    });

    const money = (v: number) =>
        v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const trend = salesTrend ?? [];
    const expenses = (expenseBreakdown ?? []).filter((e) => e.total > 0);

    return (
        <Box>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" fontWeight={800}>
                    {t('dashboard_page.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {t('dashboard_page.subtitle')}
                </Typography>
            </Box>

            <Grid container spacing={2.5}>
                {/* Hero revenue + trend */}
                <Grid item xs={12} md={7}>
                    <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, height: '100%' }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                            <Box>
                                <Typography variant="body2" color="text.secondary">
                                    {t('dashboard_page.today_sales')}
                                </Typography>
                                <Typography variant="h3" fontWeight={800} color="primary.dark" sx={{ mt: 0.5 }}>
                                    {money(summary?.today_sales ?? 0)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {t('dashboard_page.sales_trend')}
                                </Typography>
                            </Box>
                            <Avatar
                                variant="rounded"
                                sx={{
                                    bgcolor: (th) => alpha(th.palette.primary.main, 0.12),
                                    color: 'primary.dark',
                                }}
                            >
                                <TrendingUpIcon />
                            </Avatar>
                        </Stack>
                        <Box sx={{ height: 240, mt: 2 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={GOLD} stopOpacity={0.35} />
                                            <stop offset="100%" stopColor={GOLD} stopOpacity={0.02} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid vertical={false} stroke="#eef0f2" />
                                    <XAxis
                                        dataKey="period"
                                        tickFormatter={(v) => formatDate(v, i18n.language)}
                                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                                        tickLine={false}
                                        axisLine={false}
                                        minTickGap={24}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                                        tickLine={false}
                                        axisLine={false}
                                        width={48}
                                    />
                                    <Tooltip
                                        labelFormatter={(v) => formatDate(v as string, i18n.language)}
                                        formatter={(v: number) => [money(v), t('fields.total')]}
                                        contentStyle={{ borderRadius: 10, border: '1px solid #eee', fontSize: 12 }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="total"
                                        stroke={GOLD_DARK}
                                        strokeWidth={2}
                                        fill="url(#goldFill)"
                                        dot={false}
                                        activeDot={{ r: 4 }}
                                        name={t('fields.total')}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </Box>
                    </Paper>
                </Grid>

                {/* Stat grid */}
                <Grid item xs={12} md={5}>
                    <Grid container spacing={2.5}>
                        <Grid item xs={6}>
                            <StatCard
                                icon={<SavingsOutlinedIcon fontSize="small" />}
                                label={t('dashboard_page.today_profit')}
                                value={money(summary?.today_profit ?? 0)}
                                accent
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <StatCard
                                icon={<AccountBalanceWalletOutlinedIcon fontSize="small" />}
                                label={t('dashboard_page.cash_position')}
                                value={money(summary?.cash_position ?? 0)}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <StatCard
                                icon={<CallReceivedIcon fontSize="small" />}
                                label={t('dashboard_page.receivables')}
                                value={money(summary?.receivables ?? 0)}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <StatCard
                                icon={<CallMadeIcon fontSize="small" />}
                                label={t('dashboard_page.payables')}
                                value={money(summary?.payables ?? 0)}
                            />
                        </Grid>
                    </Grid>
                </Grid>

                {/* Small metric cards */}
                <Grid item xs={6} md={3}>
                    <StatCard
                        icon={<ReceiptLongOutlinedIcon fontSize="small" />}
                        label={t('dashboard_page.today_sale_count')}
                        value={String(summary?.today_sales_count ?? 0)}
                    />
                </Grid>
                <Grid item xs={6} md={3}>
                    <StatCard
                        icon={<Inventory2OutlinedIcon fontSize="small" />}
                        label={t('dashboard_page.low_stock_items')}
                        value={String(summary?.low_stock_count ?? 0)}
                    />
                </Grid>
                <Grid item xs={6} md={3}>
                    <StatCard
                        icon={<Inventory2OutlinedIcon fontSize="small" />}
                        label={t('dashboard_page.inventory_value')}
                        value={money(summary?.inventory_value ?? 0)}
                    />
                </Grid>

                {/* Expenses donut */}
                <Grid item xs={12} md={6}>
                    <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, height: '100%' }}>
                        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                            {t('dashboard_page.expenses_by_category')}
                        </Typography>
                        {expenses.length === 0 ? (
                            <Box sx={{ py: 5, textAlign: 'center' }}>
                                <Typography color="text.secondary" variant="body2">
                                    {t('dashboard_page.no_expenses')}
                                </Typography>
                            </Box>
                        ) : (
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Box sx={{ width: 180, height: 180 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={expenses}
                                                dataKey="total"
                                                nameKey="category"
                                                innerRadius={52}
                                                outerRadius={82}
                                                paddingAngle={2}
                                                stroke="#fff"
                                                strokeWidth={2}
                                            >
                                                {expenses.map((entry, index) => (
                                                    <Cell key={entry.category} fill={GOLD_RAMP[index % GOLD_RAMP.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                formatter={(v: number, n) => [money(v), n as string]}
                                                contentStyle={{ borderRadius: 10, border: '1px solid #eee', fontSize: 12 }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </Box>
                                <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
                                    {expenses.slice(0, 6).map((entry, index) => (
                                        <Stack key={entry.category} direction="row" spacing={1} alignItems="center">
                                            <Box
                                                sx={{
                                                    width: 10,
                                                    height: 10,
                                                    borderRadius: '3px',
                                                    bgcolor: GOLD_RAMP[index % GOLD_RAMP.length],
                                                    flexShrink: 0,
                                                }}
                                            />
                                            <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                                                {entry.category}
                                            </Typography>
                                            <Typography variant="body2" fontWeight={600}>
                                                {money(entry.total)}
                                            </Typography>
                                        </Stack>
                                    ))}
                                </Stack>
                            </Stack>
                        )}
                    </Paper>
                </Grid>

                {/* Recent sales */}
                <Grid item xs={12} md={6}>
                    <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, height: '100%' }}>
                        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                            {t('dashboard_page.recent_sales')}
                        </Typography>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('dashboard_page.invoice')}</TableCell>
                                    <TableCell>{t('fields.customer')}</TableCell>
                                    <TableCell align="right">{t('fields.total')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {(summary?.recent_sales ?? []).map((s) => (
                                    <TableRow key={s.id}>
                                        <TableCell>{s.invoice_number}</TableCell>
                                        <TableCell>{s.customer_name}</TableCell>
                                        <TableCell align="right">{money(s.grand_total)}</TableCell>
                                    </TableRow>
                                ))}
                                {(summary?.recent_sales ?? []).length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3}>
                                            <Typography color="text.secondary" variant="body2" sx={{ py: 2 }}>
                                                {t('dashboard_page.no_sales')}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </Paper>
                </Grid>

                {/* Top products */}
                <Grid item xs={12}>
                    <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
                        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                            {t('dashboard_page.top_products')}
                        </Typography>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('fields.product')}</TableCell>
                                    <TableCell align="right">{t('dashboard_page.qty_sold')}</TableCell>
                                    <TableCell align="right">{t('fields.revenue')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {(summary?.top_products ?? []).map((p) => (
                                    <TableRow key={p.product_id}>
                                        <TableCell>{p.name}</TableCell>
                                        <TableCell align="right">
                                            <Chip size="small" variant="outlined" label={p.quantity_sold} />
                                        </TableCell>
                                        <TableCell align="right">{money(p.revenue)}</TableCell>
                                    </TableRow>
                                ))}
                                {(summary?.top_products ?? []).length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3}>
                                            <Typography color="text.secondary" variant="body2" sx={{ py: 2 }}>
                                                {t('dashboard_page.no_sales')}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
}
