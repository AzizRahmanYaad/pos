import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Avatar,
    Box,
    Button,
    Chip,
    CircularProgress,
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
import { useTranslation } from 'react-i18next';
import { fetchPeriodClosing, reopenPeriod, type PeriodClosingSnapshotDto } from '@/features/period-closing/api';
import { Can } from '@/components/Can';
import { fetchBusinessSettings } from '@/features/settings/api';
import { formatDate } from '@/lib/calendar';

const TYPE_ICON: Record<string, React.ReactNode> = {
    customer_balance: <PeopleOutlineIcon fontSize="small" />,
    supplier_balance: <LocalShippingOutlinedIcon fontSize="small" />,
    employee_balance: <BadgeOutlinedIcon fontSize="small" />,
    cash_balance: <PaymentsOutlinedIcon fontSize="small" />,
    inventory_value: <WarehouseOutlinedIcon fontSize="small" />,
};

const TYPE_ORDER = ['cash_balance', 'customer_balance', 'supplier_balance', 'employee_balance', 'inventory_value'];

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

    const activities = closing?.activities ?? [];

    if (isLoading || !closing) {
        return (
            <Box sx={{ py: 6, textAlign: 'center' }}>
                <CircularProgress />
            </Box>
        );
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
                        <Button
                            variant="outlined"
                            color="warning"
                            startIcon={<LockOpenOutlinedIcon />}
                            disabled={reopenMutation.isPending}
                            onClick={() => reopenMutation.mutate()}
                        >
                            {t('period_closing_page.reopen')}
                        </Button>
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

                <Grid item xs={12} md={8}>
                    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
                        <Typography variant="overline" color="text.secondary">
                            {t('period_closing_page.totals')}
                        </Typography>
                        <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                            {groups.map((group) => (
                                <Grid item xs={6} sm={4} key={group.type}>
                                    <Stack direction="row" alignItems="center" spacing={1}>
                                        <Box
                                            sx={{
                                                width: 30,
                                                height: 30,
                                                borderRadius: 1.5,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                                color: 'primary.dark',
                                            }}
                                        >
                                            {TYPE_ICON[group.type]}
                                        </Box>
                                        <Box>
                                            <Typography variant="body2" fontWeight={700}>
                                                {money(group.total)}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {t(`period_closing_page.type_${group.type}`)}
                                            </Typography>
                                        </Box>
                                    </Stack>
                                </Grid>
                            ))}
                        </Grid>
                    </Paper>
                </Grid>
            </Grid>

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
