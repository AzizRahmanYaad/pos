import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Avatar,
    Box,
    Button,
    Chip,
    Divider,
    Grid,
    IconButton,
    Paper,
    Stack,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import LockClockOutlinedIcon from '@mui/icons-material/LockClockOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import { useTranslation } from 'react-i18next';
import { BrandSpinner } from '@/components/BrandSpinner';
import { fetchPeriodClosing, reopenPeriod, type PeriodClosingSnapshotDto } from '@/features/period-closing/api';
import { Can } from '@/components/Can';
import { fetchBusinessSettings } from '@/features/settings/api';
import { formatDate } from '@/lib/calendar';
import { LoadingButton } from '@/components/LoadingButton';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis,
} from 'recharts';

const TYPE_ICON: Record<string, React.ReactNode> = {
    customer_balance: <PeopleOutlineIcon fontSize="small" />,
    supplier_balance: <LocalShippingOutlinedIcon fontSize="small" />,
    employee_balance: <BadgeOutlinedIcon fontSize="small" />,
    cash_balance: <PaymentsOutlinedIcon fontSize="small" />,
    inventory_value: <WarehouseOutlinedIcon fontSize="small" />,
};

const TYPE_ORDER = ['cash_balance', 'customer_balance', 'supplier_balance', 'employee_balance', 'inventory_value'];

/** Figures about the period itself; everything else is a list of parties. */
const RESULT_TYPES = [
    'revenue', 'discounts', 'cogs', 'gross_profit',
    'operating_expense', 'payroll_cost', 'net_profit', 'purchases',
];

/**
 * One bar chart, used for the trading breakdown and for the expense
 * categories. Labelled and coloured per bar so a loss cannot be mistaken
 * for a gain at a glance.
 */
function FigureChart({
    data,
    money,
    height = 260,
}: {
    data: { label: string; value: number; color: string }[];
    money: (v: number) => string;
    height?: number;
}) {
    if (data.length === 0) return null;

    return (
        <Box sx={{ height, px: 1, pt: 2 }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 48 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RechartsTooltip formatter={(v: number) => money(v)} />
                    {/* Capped, or a lone category becomes one bar the width of
                        the card — a shape that reads as a bug, not a figure. */}
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={72}>
                        {data.map((row) => (
                            <Cell key={row.label} fill={row.color} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </Box>
    );
}

/** A single headline figure, stated plainly rather than left to be inferred. */
function FigureTile({
    label,
    value,
    hint,
    color,
    strong,
}: {
    label: string;
    value: string;
    hint?: string;
    color?: string;
    strong?: boolean;
}) {
    return (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, height: '100%' }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase" letterSpacing={0.5}>
                {label}
            </Typography>
            <Typography variant={strong ? 'h4' : 'h5'} fontWeight={800} sx={{ mt: 0.5, color: color ?? 'text.primary' }}>
                {value}
            </Typography>
            {hint && (
                <Typography variant="caption" color="text.secondary">
                    {hint}
                </Typography>
            )}
        </Paper>
    );
}

/** One line of the profit-and-loss statement. */
function StatementRow({
    label,
    value,
    muted,
    bold,
    large,
    divider,
    color,
}: {
    label: string;
    value: string;
    muted?: boolean;
    bold?: boolean;
    large?: boolean;
    divider?: boolean;
    color?: string;
}) {
    return (
        <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="baseline"
            spacing={2}
            sx={divider ? { pt: 1.25, borderTop: '1px solid', borderColor: 'divider' } : undefined}
        >
            <Typography
                variant={large ? 'subtitle1' : 'body2'}
                fontWeight={bold ? 700 : 500}
                color={muted ? 'text.secondary' : 'text.primary'}
            >
                {label}
            </Typography>
            <Typography
                variant={large ? 'h6' : 'body2'}
                fontWeight={bold ? 800 : 600}
                sx={{ color: color ?? (muted ? 'error.main' : 'text.primary'), whiteSpace: 'nowrap' }}
            >
                {value}
            </Typography>
        </Stack>
    );
}

export function PeriodClosingDetailPage() {
    const { t, i18n } = useTranslation();
    const theme = useTheme();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const id = Number(useParams().id);

    const { data: closing, isLoading } = useQuery({
        queryKey: ['period-closing', id],
        queryFn: () => fetchPeriodClosing(id),
    });
    const { data: settings } = useQuery({ queryKey: ['business-settings'], queryFn: fetchBusinessSettings });

    const [reopenError, setReopenError] = useState<string | null>(null);
    const reopenMutation = useMutation({
        mutationFn: () => reopenPeriod(id),
        meta: { successMessage: t('period_closing_page.reopen_success') },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['period-closing', id] });
            queryClient.invalidateQueries({ queryKey: ['period-closings'] });
            setReopenError(null);
        },
        onError: () => setReopenError(t('period_closing_page.reopen_failed')),
    });

    const sym = settings?.currency_symbol ?? '';
    const money = (v: number) =>
        `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${sym ? ` ${sym}` : ''}`;

    /* A deduction of nothing is not a negative amount: "− 0.00" reads as an
       error to anyone checking their own figures. */
    const deduction = (v: number) => (v === 0 ? money(0) : `− ${money(v)}`);

    /* A margin on nothing sold is not zero percent, it is undefined — saying
       "0%" there would read as a business that sold and made nothing. */
    const percent = (part: number, whole: number) => (whole === 0 ? '—' : `${((part / whole) * 100).toFixed(1)}%`);

    const formatDateTime = (iso: string) => {
        const time = new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        return `${formatDate(iso, i18n.language)} ${time}`;
    };

    const groups = useMemo(() => {
        const snapshots = closing?.snapshots ?? [];
        const byType = new Map<string, PeriodClosingSnapshotDto[]>();
        for (const snap of snapshots) {
            const list = byType.get(snap.snapshot_type) ?? [];
            list.push(snap);
            byType.set(snap.snapshot_type, list);
        }
        return TYPE_ORDER.filter((type) => byType.has(type)).map((type) => {
            const rows = byType.get(type)!;
            return { type, rows, total: rows.reduce((sum, r) => sum + r.amount, 0) };
        });
    }, [closing]);

    /**
     * What the period traded, as recorded the moment it was closed. Periods
     * closed before these figures were kept have none, and are shown as such
     * rather than as a screen full of zeroes that look like a dead business.
     */
    const results = useMemo(() => {
        const snaps = closing?.snapshots ?? [];
        if (!RESULT_TYPES.some((type) => snaps.some((s) => s.snapshot_type === type))) {
            return null;
        }

        const figure = (type: string) => snaps.find((s) => s.snapshot_type === type);
        const expenseRows = snaps
            .filter((s) => s.snapshot_type === 'operating_expense')
            .slice()
            .sort((a, b) => b.amount - a.amount);

        const revenueRow = figure('revenue');
        const revenue = revenueRow?.amount ?? 0;
        const discounts = figure('discounts')?.amount ?? 0;
        const expenses = expenseRows.reduce((sum, row) => sum + row.amount, 0);

        return {
            revenue,
            discounts,
            netRevenue: revenue - discounts,
            cogs: figure('cogs')?.amount ?? 0,
            grossProfit: figure('gross_profit')?.amount ?? 0,
            payroll: figure('payroll_cost')?.amount ?? 0,
            netProfit: figure('net_profit')?.amount ?? 0,
            purchases: figure('purchases')?.amount ?? 0,
            salesCount: revenueRow?.quantity ?? 0,
            expenses,
            expenseRows,
        };
    }, [closing]);

    /** What was left standing when the books shut, split by who owes whom. */
    const position = useMemo(() => {
        const snaps = closing?.snapshots ?? [];
        const sum = (type: string, pick: (amount: number) => number) =>
            snaps.filter((s) => s.snapshot_type === type).reduce((total, s) => total + pick(s.amount), 0);

        return {
            // Debit positive, credit negative: a customer in debit owes the
            // shop, a supplier in credit is owed by it.
            receivables: sum('customer_balance', (v) => Math.max(0, v)),
            customerAdvances: sum('customer_balance', (v) => Math.max(0, -v)),
            payables: sum('supplier_balance', (v) => Math.max(0, -v)),
            staffAdvances: sum('employee_balance', (v) => Math.max(0, v)),
            cash: sum('cash_balance', (v) => v),
            inventory: sum('inventory_value', (v) => v),
        };
    }, [closing]);

    const activities = closing?.activities ?? [];

    if (isLoading || !closing) {
        return <BrandSpinner fullPage minHeight={280} label={t('common.loading')} />;
    }

    return (
        <Box>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
                <IconButton onClick={() => navigate('/period-closing')} aria-label={t('actions.cancel')}>
                    <ArrowBackIcon />
                </IconButton>
                <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.9) }}>
                    <LockClockOutlinedIcon />
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="h5" fontWeight={800} noWrap>
                        {t(`period_closing_page.${closing.period_type}`)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {formatDate(closing.period_start, i18n.language)} — {formatDate(closing.period_end, i18n.language)}
                    </Typography>
                </Box>
                <Chip
                    color={closing.status === 'closed' ? 'success' : 'warning'}
                    variant={closing.status === 'closed' ? 'filled' : 'outlined'}
                    label={t(`status.${closing.status}`)}
                    sx={{ fontWeight: 700, height: 32 }}
                />
            </Stack>

            {closing.status === 'closed' && (
                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                    <Can permission="period-closing.reopen">
                        <LoadingButton
                            variant="outlined"
                            color="warning"
                            startIcon={<LockOpenOutlinedIcon />}
                            loading={reopenMutation.isPending}
                            onClick={() => reopenMutation.mutate()}
                        >
                            {t('period_closing_page.reopen')}
                        </LoadingButton>
                    </Can>
                </Stack>
            )}
            {reopenError && (
                <Typography variant="body2" color="error" sx={{ mb: 2 }}>
                    {reopenError}
                </Typography>
            )}

            <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
                <Grid item xs={12} md={4}>
                    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
                        <Typography variant="overline" color="text.secondary">
                            {t('period_closing_page.closing_details')}
                        </Typography>
                        <Stack spacing={1.25} sx={{ mt: 1 }}>
                            <Stack direction="row" justifyContent="space-between">
                                <Typography variant="body2" color="text.secondary">
                                    {t('period_closing_page.closed_by')}
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>
                                    {closing.closed_by ?? '—'}
                                </Typography>
                            </Stack>
                            <Stack direction="row" justifyContent="space-between">
                                <Typography variant="body2" color="text.secondary">
                                    {t('period_closing_page.closed_at')}
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>
                                    {closing.closed_at ? formatDateTime(closing.closed_at) : '—'}
                                </Typography>
                            </Stack>
                            {closing.notes && (
                                <Box>
                                    <Typography variant="body2" color="text.secondary">
                                        {t('period_closing_page.notes')}
                                    </Typography>
                                    <Typography variant="body2">{closing.notes}</Typography>
                                </Box>
                            )}
                        </Stack>
                    </Paper>
                </Grid>

                {/*
                  * What the period earned, stated before anything else. The
                  * balances further down say what the shop was worth on the
                  * last day; these say what it did to get there, which is the
                  * question anyone closing a month actually asks first.
                  */}
                <Grid item xs={12} md={8}>
                    {results === null ? (
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
                            <Typography variant="overline" color="text.secondary">
                                {t('period_closing_page.results')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                {t('period_closing_page.no_results')}
                            </Typography>
                        </Paper>
                    ) : (
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <FigureTile
                                    label={t('fields.revenue')}
                                    value={money(results.revenue)}
                                    hint={t('period_closing_page.from_sales', { count: results.salesCount })}
                                    color={theme.palette.success.main}
                                    strong
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <FigureTile
                                    label={t('fields.gross_profit')}
                                    value={money(results.grossProfit)}
                                    hint={t('period_closing_page.gross_margin', {
                                        percent: percent(results.grossProfit, results.netRevenue),
                                    })}
                                    color={theme.palette.info.main}
                                    strong
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <FigureTile
                                    label={t('period_closing_page.total_costs')}
                                    value={money(results.expenses + results.payroll)}
                                    hint={t('period_closing_page.expenses_and_salaries')}
                                    color={theme.palette.error.main}
                                    strong
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <FigureTile
                                    label={
                                        results.netProfit >= 0
                                            ? t('fields.net_profit')
                                            : t('reports_page.net_loss')
                                    }
                                    value={money(results.netProfit)}
                                    hint={t('period_closing_page.net_margin', {
                                        percent: percent(results.netProfit, results.netRevenue),
                                    })}
                                    color={
                                        results.netProfit >= 0
                                            ? theme.palette.success.main
                                            : theme.palette.error.main
                                    }
                                    strong
                                />
                            </Grid>
                        </Grid>
                    )}
                </Grid>
            </Grid>

            {results !== null && (
                <>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                        <AssessmentOutlinedIcon fontSize="small" color="action" />
                        <Typography variant="subtitle1" fontWeight={700}>
                            {t('period_closing_page.results')}
                        </Typography>
                    </Stack>

                    <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
                        {/* The statement itself: every line from takings down
                            to what was left, in the order it is deducted. */}
                        <Grid item xs={12} md={5}>
                            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
                                <Typography variant="overline" color="text.secondary">
                                    {t('reports_page.profit_loss')}
                                </Typography>
                                <Stack spacing={1.25} sx={{ mt: 1.5 }}>
                                    <StatementRow label={t('fields.revenue')} value={money(results.revenue)} />
                                    <StatementRow
                                        label={t('reports_page.total_discounts')}
                                        value={deduction(results.discounts)}
                                        muted
                                    />
                                    <StatementRow
                                        label={t('reports_page.net_revenue')}
                                        value={money(results.netRevenue)}
                                        bold
                                        divider
                                    />
                                    <StatementRow label={t('fields.cogs')} value={deduction(results.cogs)} muted />
                                    <StatementRow
                                        label={t('fields.gross_profit')}
                                        value={money(results.grossProfit)}
                                        bold
                                        divider
                                    />
                                    <StatementRow
                                        label={t('reports_page.total_operating_expenses')}
                                        value={deduction(results.expenses)}
                                        muted
                                    />
                                    <StatementRow
                                        label={t('reports_page.total_salaries')}
                                        value={deduction(results.payroll)}
                                        muted
                                    />
                                    <StatementRow
                                        label={
                                            results.netProfit >= 0
                                                ? t('fields.net_profit')
                                                : t('reports_page.net_loss')
                                        }
                                        value={money(results.netProfit)}
                                        bold
                                        large
                                        divider
                                        color={
                                            results.netProfit >= 0
                                                ? theme.palette.success.main
                                                : theme.palette.error.main
                                        }
                                    />
                                </Stack>
                            </Paper>
                        </Grid>

                        {/* The same figures as a picture: what came in, what
                            each thing took out of it, and what was left. */}
                        <Grid item xs={12} md={7}>
                            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
                                <Typography variant="overline" color="text.secondary">
                                    {t('reports_page.breakdown_chart')}
                                </Typography>
                                <FigureChart
                                    money={money}
                                    height={300}
                                    data={[
                                        {
                                            label: t('fields.revenue'),
                                            value: results.revenue,
                                            color: theme.palette.success.main,
                                        },
                                        {
                                            label: t('reports_page.total_discounts'),
                                            value: results.discounts,
                                            color: theme.palette.error.main,
                                        },
                                        {
                                            label: t('fields.cogs'),
                                            value: results.cogs,
                                            color: theme.palette.error.main,
                                        },
                                        {
                                            label: t('reports_page.total_operating_expenses'),
                                            value: results.expenses,
                                            color: theme.palette.error.main,
                                        },
                                        {
                                            label: t('reports_page.total_salaries'),
                                            value: results.payroll,
                                            color: theme.palette.error.main,
                                        },
                                        {
                                            label:
                                                results.netProfit >= 0
                                                    ? t('fields.net_profit')
                                                    : t('reports_page.net_loss'),
                                            value: Math.abs(results.netProfit),
                                            color:
                                                results.netProfit >= 0
                                                    ? theme.palette.success.main
                                                    : theme.palette.error.main,
                                        },
                                    ]}
                                />
                            </Paper>
                        </Grid>
                    </Grid>

                    <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
                        {/* Which costs the money actually went on — a total
                            alone never tells anyone what to cut. */}
                        <Grid item xs={12} md={7}>
                            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
                                <Typography variant="overline" color="text.secondary">
                                    {t('reports_page.operating_expenses_by_category')}
                                </Typography>
                                {results.expenseRows.length === 0 ? (
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                        {t('reports_page.no_data')}
                                    </Typography>
                                ) : (
                                    <>
                                        <FigureChart
                                            money={money}
                                            data={results.expenseRows.map((row) => ({
                                                label: row.reference_label ?? t('common.none'),
                                                value: row.amount,
                                                color: theme.palette.warning.main,
                                            }))}
                                        />
                                        <Stack spacing={1} sx={{ mt: 1 }}>
                                            {results.expenseRows.map((row) => (
                                                <StatementRow
                                                    key={row.id}
                                                    label={row.reference_label ?? t('common.none')}
                                                    value={money(row.amount)}
                                                />
                                            ))}
                                            <StatementRow
                                                label={t('reports_page.total_operating_expenses')}
                                                value={money(results.expenses)}
                                                bold
                                                divider
                                            />
                                        </Stack>
                                    </>
                                )}
                            </Paper>
                        </Grid>

                        {/* Everything the period did that is not profit: what
                            was bought, and how much trade it took. */}
                        <Grid item xs={12} md={5}>
                            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
                                <Typography variant="overline" color="text.secondary">
                                    {t('period_closing_page.trading_activity')}
                                </Typography>
                                <Stack spacing={1.25} sx={{ mt: 1.5 }}>
                                    <StatementRow
                                        label={t('reports_page.sale_count')}
                                        value={String(results.salesCount)}
                                    />
                                    <StatementRow
                                        label={t('period_closing_page.average_sale')}
                                        value={money(
                                            results.salesCount > 0 ? results.netRevenue / results.salesCount : 0,
                                        )}
                                    />
                                    <StatementRow
                                        label={t('period_closing_page.purchases_received')}
                                        value={money(results.purchases)}
                                    />
                                    <StatementRow
                                        label={t('period_closing_page.gross_margin_label')}
                                        value={percent(results.grossProfit, results.netRevenue)}
                                        divider
                                    />
                                    <StatementRow
                                        label={t('period_closing_page.net_margin_label')}
                                        value={percent(results.netProfit, results.netRevenue)}
                                        color={
                                            results.netProfit >= 0
                                                ? theme.palette.success.main
                                                : theme.palette.error.main
                                        }
                                        bold
                                    />
                                </Stack>
                            </Paper>
                        </Grid>
                    </Grid>
                </>
            )}

            {/* Who owed whom when the books shut. Receivables and payables are
                the halves of the balance the owner is chasing next month. */}
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, mb: 2.5 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                    <AccountBalanceOutlinedIcon fontSize="small" color="action" />
                    <Typography variant="subtitle1" fontWeight={700}>
                        {t('period_closing_page.position')}
                    </Typography>
                </Stack>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={4} lg={2.4}>
                        <FigureTile
                            label={t('reports_page.accounts_receivable')}
                            value={money(position.receivables)}
                            hint={t('period_closing_page.receivable_hint')}
                            color={theme.palette.success.main}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4} lg={2.4}>
                        <FigureTile
                            label={t('reports_page.accounts_payable')}
                            value={money(position.payables)}
                            hint={t('period_closing_page.payable_hint')}
                            color={theme.palette.error.main}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4} lg={2.4}>
                        <FigureTile
                            label={t('reports_page.cash_balance')}
                            value={money(position.cash)}
                            hint={t('period_closing_page.cash_hint')}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4} lg={2.4}>
                        <FigureTile
                            label={t('reports_page.inventory_value')}
                            value={money(position.inventory)}
                            hint={t('period_closing_page.inventory_hint')}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4} lg={2.4}>
                        <FigureTile
                            label={t('period_closing_page.staff_advances')}
                            value={money(position.staffAdvances)}
                            hint={t('period_closing_page.staff_advances_hint')}
                        />
                    </Grid>
                </Grid>
                {position.customerAdvances > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                        {t('period_closing_page.customer_advances', { amount: money(position.customerAdvances) })}
                    </Typography>
                )}
            </Paper>

            {/* Operations in this period — displayed as ledger-style log records */}
            <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', mb: 2.5 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 2, pb: 1.5 }}>
                    <LockOutlinedIcon fontSize="small" color="action" />
                    <Typography variant="subtitle1" fontWeight={700}>
                        {t('period_closing_page.operations')}
                    </Typography>
                </Stack>
                <Divider />
                {groups.length === 0 ? (
                    <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                        {t('period_closing_page.no_operations')}
                    </Typography>
                ) : (
                    groups.map((group, gi) => (
                        <Box key={group.type}>
                            <Stack
                                direction="row"
                                justifyContent="space-between"
                                alignItems="center"
                                sx={{ px: 2, py: 1, bgcolor: 'action.hover' }}
                            >
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    {TYPE_ICON[group.type]}
                                    <Typography variant="body2" fontWeight={700}>
                                        {t(`period_closing_page.type_${group.type}`)}
                                    </Typography>
                                    <Chip size="small" variant="outlined" label={group.rows.length} />
                                </Stack>
                                <Typography variant="body2" fontWeight={700}>
                                    {money(group.total)}
                                </Typography>
                            </Stack>
                            <Box>
                                {group.rows.map((row) => (
                                    <Stack
                                        key={row.id}
                                        direction="row"
                                        justifyContent="space-between"
                                        alignItems="center"
                                        sx={{
                                            px: 2,
                                            py: 1,
                                            borderBottom: '1px solid',
                                            borderColor: 'divider',
                                        }}
                                    >
                                        <Typography variant="body2" color="text.secondary" noWrap>
                                            {row.reference_label ?? t('common.none')}
                                            {row.quantity !== null ? ` · ${row.quantity}` : ''}
                                        </Typography>
                                        <Typography variant="body2">{money(row.amount)}</Typography>
                                    </Stack>
                                ))}
                            </Box>
                            {gi < groups.length - 1 && <Divider />}
                        </Box>
                    ))
                )}
            </Paper>

            {/* Activity log — a chronological audit trail of close/reopen events */}
            <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 2, pb: 1.5 }}>
                    <HistoryOutlinedIcon fontSize="small" color="action" />
                    <Typography variant="subtitle1" fontWeight={700}>
                        {t('period_closing_page.activity_log')}
                    </Typography>
                </Stack>
                <Divider />
                {activities.length === 0 ? (
                    <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                        {t('period_closing_page.no_activity')}
                    </Typography>
                ) : (
                    activities.map((entry, i) => (
                        <Stack
                            key={entry.id}
                            direction="row"
                            alignItems="flex-start"
                            spacing={1.5}
                            sx={{
                                px: 2,
                                py: 1.5,
                                borderBottom: i < activities.length - 1 ? '1px solid' : 'none',
                                borderColor: 'divider',
                            }}
                        >
                            <Box
                                sx={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    bgcolor:
                                        entry.description === 'period_reopened'
                                            ? alpha(theme.palette.warning.main, 0.15)
                                            : alpha(theme.palette.success.main, 0.15),
                                    color:
                                        entry.description === 'period_reopened'
                                            ? theme.palette.warning.main
                                            : theme.palette.success.main,
                                    flexShrink: 0,
                                }}
                            >
                                {entry.description === 'period_reopened' ? (
                                    <LockOpenOutlinedIcon fontSize="small" />
                                ) : (
                                    <LockOutlinedIcon fontSize="small" />
                                )}
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body2" fontWeight={600}>
                                    {t(`period_closing_page.activity_${entry.description}`, {
                                        defaultValue: entry.description,
                                    })}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {entry.causer_name ?? t('common.none')} · {formatDateTime(entry.created_at)}
                                </Typography>
                            </Box>
                        </Stack>
                    ))
                )}
            </Paper>
        </Box>
    );
}
