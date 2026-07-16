import { useQuery } from '@tanstack/react-query';
import {
    Box,
    Card,
    CardContent,
    Grid,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
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

const CHART_COLORS = ['#1976d2', '#9c27b0', '#2e7d32', '#ed6c02', '#d32f2f', '#0288d1'];

function KpiTile({ label, value }: { label: string; value: string }) {
    return (
        <Grid item xs={12} sm={6} md={3}>
            <Card>
                <CardContent>
                    <Typography color="text.secondary" variant="body2">
                        {label}
                    </Typography>
                    <Typography variant="h5">{value}</Typography>
                </CardContent>
            </Card>
        </Grid>
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

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                {t('nav.dashboard')}
            </Typography>

            <Grid container spacing={2} sx={{ mb: 3 }}>
                <KpiTile label={t('dashboard_page.today_sales')} value={(summary?.today_sales ?? 0).toFixed(2)} />
                <KpiTile label={t('dashboard_page.today_profit')} value={(summary?.today_profit ?? 0).toFixed(2)} />
                <KpiTile label={t('dashboard_page.cash_position')} value={(summary?.cash_position ?? 0).toFixed(2)} />
                <KpiTile label={t('dashboard_page.low_stock_items')} value={String(summary?.low_stock_count ?? 0)} />
                <KpiTile label={t('dashboard_page.receivables')} value={(summary?.receivables ?? 0).toFixed(2)} />
                <KpiTile label={t('dashboard_page.payables')} value={(summary?.payables ?? 0).toFixed(2)} />
                <KpiTile label={t('dashboard_page.today_sale_count')} value={String(summary?.today_sales_count ?? 0)} />
            </Grid>

            <Grid container spacing={2}>
                <Grid item xs={12} md={7}>
                    <Paper sx={{ p: 2, height: 340 }}>
                        <Typography variant="subtitle1" gutterBottom>
                            {t('dashboard_page.sales_trend')}
                        </Typography>
                        <ResponsiveContainer width="100%" height="90%">
                            <BarChart data={salesTrend ?? []}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="period" tickFormatter={(value) => formatDate(value, i18n.language)} />
                                <YAxis />
                                <Tooltip labelFormatter={(value) => formatDate(value as string, i18n.language)} />
                                <Bar dataKey="total" fill="#1976d2" name={t('fields.total')} />
                            </BarChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={5}>
                    <Paper sx={{ p: 2, height: 340 }}>
                        <Typography variant="subtitle1" gutterBottom>
                            {t('dashboard_page.expenses_by_category')}
                        </Typography>
                        <ResponsiveContainer width="100%" height="90%">
                            <PieChart>
                                <Pie
                                    data={expenseBreakdown ?? []}
                                    dataKey="total"
                                    nameKey="category"
                                    outerRadius={100}
                                    label
                                >
                                    {(expenseBreakdown ?? []).map((entry, index) => (
                                        <Cell key={entry.category} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                        <Typography variant="subtitle1" gutterBottom>
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
                                        <TableCell align="right">{p.quantity_sold}</TableCell>
                                        <TableCell align="right">{p.revenue.toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                        <Typography variant="subtitle1" gutterBottom>
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
                                        <TableCell align="right">{s.grand_total.toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
}
