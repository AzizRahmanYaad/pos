import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    IconButton,
    MenuItem,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import LockClockOutlinedIcon from '@mui/icons-material/LockClockOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import { useTranslation } from 'react-i18next';
import { fetchPeriodClosings, closePeriod, type PeriodClosingDto } from '@/features/period-closing/api';
import { fetchBusinessSettings } from '@/features/settings/api';
import { Can } from '@/components/Can';
import { DualDateField } from '@/components/DualDateField';
import { formatDate } from '@/lib/calendar';
import { LoadingButton } from '@/components/LoadingButton';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis,
} from 'recharts';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';

function StatTile({
    icon,
    label,
    value,
    color,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    color: string;
}) {
    return (
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box
                    sx={{
                        width: 42,
                        height: 42,
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: alpha(color, 0.12),
                        color,
                    }}
                >
                    {icon}
                </Box>
                <Box>
                    <Typography variant="h5" fontWeight={800}>
                        {value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {label}
                    </Typography>
                </Box>
            </Stack>
        </Paper>
    );
}

/**
 * What a period traded, pulled off the figures recorded when it closed.
 *
 * The list is the page reached by the Clearance menu, so a shopkeeper
 * should be able to see whether a month made money without opening it
 * first. Periods closed before these figures were kept simply have none.
 */
function resultsOf(closing: PeriodClosingDto) {
    const snaps = closing.snapshots ?? [];
    const figure = (type: string) => snaps.find((s) => s.snapshot_type === type)?.amount;

    const revenue = figure('revenue');
    if (revenue === undefined) return null;

    return {
        revenue,
        netProfit: figure('net_profit') ?? 0,
        grossProfit: figure('gross_profit') ?? 0,
        salesCount: snaps.find((s) => s.snapshot_type === 'revenue')?.quantity ?? 0,
    };
}

export function PeriodClosingPage() {
    const { t, i18n } = useTranslation();
    const theme = useTheme();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { data: closings, isLoading } = useQuery({ queryKey: ['period-closings'], queryFn: fetchPeriodClosings });
    const { data: settings } = useQuery({ queryKey: ['business-settings'], queryFn: fetchBusinessSettings });

    const sym = settings?.currency_symbol ?? '';
    const money = (v: number) =>
        `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${sym ? ` ${sym}` : ''}`;

    const [newOpen, setNewOpen] = useState(false);
    const [periodType, setPeriodType] = useState<'daily' | 'monthly' | 'custom'>('daily');
    const [periodStart, setPeriodStart] = useState('');
    const [periodEnd, setPeriodEnd] = useState('');
    const [error, setError] = useState<string | null>(null);

    const closeMutation = useMutation({
        mutationFn: closePeriod,
        meta: { successMessage: t('period_closing_page.close_success') },
        onSuccess: (closing) => {
            queryClient.invalidateQueries({ queryKey: ['period-closings'] });
            setNewOpen(false);
            setPeriodStart('');
            setPeriodEnd('');
            setError(null);
            navigate(`/period-closing/${closing.id}`);
        },
        onError: () => setError(t('period_closing_page.close_failed')),
    });

    const closedCount = closings?.filter((c) => c.status === 'closed').length ?? 0;
    const reopenedCount = closings?.filter((c) => c.status === 'reopened').length ?? 0;

    // Totals and a trend across every period that recorded its trading.
    const traded = useMemo(() => {
        const rows = (closings ?? [])
            .map((closing) => ({ closing, results: resultsOf(closing) }))
            .filter((row): row is { closing: PeriodClosingDto; results: NonNullable<ReturnType<typeof resultsOf>> } =>
                row.results !== null,
            );

        return {
            any: rows.length > 0,
            revenue: rows.reduce((sum, r) => sum + r.results.revenue, 0),
            netProfit: rows.reduce((sum, r) => sum + r.results.netProfit, 0),
            // Oldest first, so the chart reads left to right in time.
            chart: rows
                .slice()
                .reverse()
                .map((r) => ({
                    label: formatDate(r.closing.period_end, i18n.language),
                    revenue: r.results.revenue,
                    profit: r.results.netProfit,
                })),
        };
    }, [closings, i18n.language]);

    return (
        <Box>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={2} sx={{ mb: 3 }}>
                <Box>
                    <Typography variant="h4" fontWeight={800}>
                        {t('nav.period_closing')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {t('period_closing_page.subtitle')}
                    </Typography>
                </Box>
                <Can permission="period-closing.close">
                    <Button variant="contained" size="large" onClick={() => setNewOpen(true)}>
                        {t('period_closing_page.close_a_period')}
                    </Button>
                </Can>
            </Stack>

            <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
                <Grid item xs={12} sm={6} md={4}>
                    <StatTile
                        icon={<LockClockOutlinedIcon />}
                        label={t('period_closing_page.total_closings')}
                        value={String(closings?.length ?? 0)}
                        color={theme.palette.primary.main}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <StatTile
                        icon={<LockOutlinedIcon />}
                        label={t('period_closing_page.currently_closed')}
                        value={String(closedCount)}
                        color={theme.palette.success.main}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <StatTile
                        icon={<LockOpenOutlinedIcon />}
                        label={t('period_closing_page.reopened_count')}
                        value={String(reopenedCount)}
                        color={theme.palette.warning.main}
                    />
                </Grid>
                {/* Counting closings says how often the books were shut. What
                    the owner came to find out is what they were shut on. */}
                {traded.any && (
                    <>
                        <Grid item xs={12} sm={6} md={4}>
                            <StatTile
                                icon={<TrendingUpOutlinedIcon />}
                                label={t('period_closing_page.total_revenue')}
                                value={money(traded.revenue)}
                                color={theme.palette.success.main}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <StatTile
                                icon={<SavingsOutlinedIcon />}
                                label={
                                    traded.netProfit >= 0
                                        ? t('period_closing_page.total_net_profit')
                                        : t('reports_page.net_loss')
                                }
                                value={money(traded.netProfit)}
                                color={
                                    traded.netProfit >= 0 ? theme.palette.success.main : theme.palette.error.main
                                }
                            />
                        </Grid>
                    </>
                )}
            </Grid>

            {traded.chart.length > 0 && (
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, mb: 2.5 }}>
                    <Typography variant="overline" color="text.secondary">
                        {t('period_closing_page.trend')}
                    </Typography>
                    <Box sx={{ height: 280, mt: 1 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={traded.chart} margin={{ top: 8, right: 8, left: -12, bottom: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={56} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <RechartsTooltip formatter={(v: number) => money(v)} />
                                <Legend />
                                <Bar
                                    dataKey="revenue"
                                    name={t('fields.revenue')}
                                    fill={theme.palette.primary.main}
                                    radius={[6, 6, 0, 0]}
                                    maxBarSize={56}
                                />
                                <Bar
                                    dataKey="profit"
                                    name={t('fields.net_profit')}
                                    fill={theme.palette.success.main}
                                    radius={[6, 6, 0, 0]}
                                    maxBarSize={56}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </Box>
                </Paper>
            )}

            <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                                <TableCell>{t('fields.type')}</TableCell>
                                <TableCell>{t('fields.from')}</TableCell>
                                <TableCell>{t('fields.to')}</TableCell>
                                <TableCell align="right">{t('fields.revenue')}</TableCell>
                                <TableCell align="right">{t('fields.net_profit')}</TableCell>
                                <TableCell>{t('period_closing_page.closed_by')}</TableCell>
                                <TableCell>{t('fields.status')}</TableCell>
                                <TableCell align="right"> </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={8}>
                                        <Box sx={{ py: 4, textAlign: 'center' }}>
                                            <CircularProgress size={28} />
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            )}
                            {closings?.map((closing) => (
                                <TableRow
                                    key={closing.id}
                                    hover
                                    sx={{ cursor: 'pointer' }}
                                    onClick={() => navigate(`/period-closing/${closing.id}`)}
                                >
                                    <TableCell sx={{ fontWeight: 600 }}>
                                        {t(`period_closing_page.${closing.period_type}`)}
                                    </TableCell>
                                    <TableCell>{formatDate(closing.period_start, i18n.language)}</TableCell>
                                    <TableCell>{formatDate(closing.period_end, i18n.language)}</TableCell>
                                    {(() => {
                                        const results = resultsOf(closing);

                                        // A period closed before the figures
                                        // were kept has none — an em dash is
                                        // the truth, where 0.00 would be a lie.
                                        if (!results) {
                                            return (
                                                <>
                                                    <TableCell align="right" sx={{ color: 'text.disabled' }}>
                                                        —
                                                    </TableCell>
                                                    <TableCell align="right" sx={{ color: 'text.disabled' }}>
                                                        —
                                                    </TableCell>
                                                </>
                                            );
                                        }

                                        return (
                                            <>
                                                <TableCell align="right" sx={{ fontWeight: 600 }}>
                                                    {money(results.revenue)}
                                                </TableCell>
                                                <TableCell
                                                    align="right"
                                                    sx={{
                                                        fontWeight: 700,
                                                        color:
                                                            results.netProfit >= 0 ? 'success.main' : 'error.main',
                                                    }}
                                                >
                                                    {money(results.netProfit)}
                                                </TableCell>
                                            </>
                                        );
                                    })()}
                                    <TableCell>{closing.closed_by ?? '—'}</TableCell>
                                    <TableCell>
                                        <Chip
                                            size="small"
                                            color={closing.status === 'closed' ? 'success' : 'warning'}
                                            variant={closing.status === 'closed' ? 'filled' : 'outlined'}
                                            label={t(`status.${closing.status}`)}
                                        />
                                    </TableCell>
                                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                                        <Tooltip title={t('actions.view')}>
                                            <IconButton
                                                size="small"
                                                color="primary"
                                                onClick={() => navigate(`/period-closing/${closing.id}`)}
                                            >
                                                <VisibilityOutlinedIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {closings && closings.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8}>
                                        <Box sx={{ py: 6, textAlign: 'center' }}>
                                            <EventRepeatOutlinedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                                            <Typography color="text.secondary">
                                                {t('period_closing_page.no_closings')}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            <Dialog open={newOpen} onClose={() => setNewOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>{t('period_closing_page.close_a_period')}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        {error && <Alert severity="error">{error}</Alert>}
                        <TextField
                            select
                            label={t('fields.type')}
                            value={periodType}
                            onChange={(e) => setPeriodType(e.target.value as typeof periodType)}
                            fullWidth
                        >
                            <MenuItem value="daily">{t('period_closing_page.daily')}</MenuItem>
                            <MenuItem value="monthly">{t('period_closing_page.monthly')}</MenuItem>
                            <MenuItem value="custom">{t('period_closing_page.custom')}</MenuItem>
                        </TextField>
                        <DualDateField label={t('fields.from')} value={periodStart} onChange={setPeriodStart} fullWidth />
                        <DualDateField label={t('fields.to')} value={periodEnd} onChange={setPeriodEnd} fullWidth />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setNewOpen(false)}>{t('actions.cancel')}</Button>
                    <LoadingButton
                        variant="contained"
                        loading={closeMutation.isPending}
                        disabled={!periodStart || !periodEnd}
                        onClick={() =>
                            closeMutation.mutate({ period_type: periodType, period_start: periodStart, period_end: periodEnd })
                        }
                    >
                        {t('actions.save')}
                    </LoadingButton>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
