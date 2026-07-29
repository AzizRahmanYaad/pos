import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Alert,
    Avatar,
    Box,
    Chip,
    IconButton,
    MenuItem,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableFooter,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import { useTranslation } from 'react-i18next';
import { BrandSpinner } from '@/components/BrandSpinner';
import { fetchPayrollRun, payPayrollRun, downloadPayrollReportPdf } from '@/features/payroll/api';
import { fetchCashAccounts } from '@/features/cash-accounts/api';
import { invalidateCashViews } from '@/lib/cashInvalidation';
import { fetchBusinessSettings } from '@/features/settings/api';
import { formatDate } from '@/lib/calendar';
import { LoadingButton } from '@/components/LoadingButton';
import { DocumentActions } from '@/components/DocumentActions';
import { downloadOrToast } from '@/lib/reportDownload';

export function PayrollRunDetailPage() {
    const { t } = useTranslation();
    const theme = useTheme();
    const months = t('months', { returnObjects: true }) as string[];
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const id = Number(useParams().id);
    const [busyPdf, setBusyPdf] = useState(false);
    const [payingCashAccountId, setPayingCashAccountId] = useState<number | ''>('');

    const { data: run, isLoading, isError } = useQuery({
        queryKey: ['payroll-run', id],
        queryFn: () => fetchPayrollRun(id),
    });
    const { data: cashAccounts } = useQuery({ queryKey: ['cash-accounts'], queryFn: fetchCashAccounts });
    const { data: settings } = useQuery({ queryKey: ['business-settings'], queryFn: fetchBusinessSettings });

    const payMutation = useMutation({
        mutationFn: () => payPayrollRun(id, payingCashAccountId as number),
        meta: {
            successMessage: t('payroll_page.pay_success'),
            errorMessage: t('payroll_page.pay_failed'),
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payroll-run', id] });
            queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
            invalidateCashViews(queryClient);
        },
    });

    const money = (v: number) =>
        v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const sym = settings?.currency_symbol ?? '';
    const withSym = (v: number) => `${money(v)}${sym ? ` ${sym}` : ''}`;

    const openPdf = async (print: boolean) => {
        setBusyPdf(true);
        try {
            const result = await downloadOrToast(() => downloadPayrollReportPdf(id));
            if (!result) return;
            const { url } = result;
            const win = window.open(url, '_blank');
            if (print && win) {
                win.addEventListener('load', () => setTimeout(() => win.print(), 400));
            }
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } finally {
            setBusyPdf(false);
        }
    };

    const shareWhatsApp = async () => {
        if (!run) return;
        setBusyPdf(true);
        try {
            const result = await downloadOrToast(() => downloadPayrollReportPdf(id));
            if (!result) return;
            const { url, filename, blob } = result;
            const period = `${months[run.period_month - 1]} ${run.period_year}`;
            const message = t('payroll_page.wa_message', {
                company: settings?.company_name ?? '',
                period,
                total: withSym(run.total_net_pay),
            });
            const file = new File([blob], filename, { type: 'application/pdf' });

            const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
            if (nav.canShare?.({ files: [file] })) {
                try {
                    await nav.share({ files: [file], text: message });
                    return;
                } catch {
                    /* cancelled */
                }
            }

            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = filename;
            anchor.click();
            window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } finally {
            setBusyPdf(false);
        }
    };

    if (isLoading) {
        return <BrandSpinner fullPage minHeight={280} label={t('common.loading')} />;
    }

    // A payroll run this device has never held, asked for with no
    // connection. The spinner used to stay up for ever here, which reads
    // as an app that has hung rather than as the one thing that is
    // actually true: it cannot be fetched right now.
    if (isError || !run) {
        return (
            <Alert severity="info" sx={{ mt: 2 }}>
                {t('offline.record_unavailable')}
            </Alert>
        );
    }

    const totalBase = run.items.reduce((s, i) => s + i.base_salary, 0);
    const totalAdvances = run.items.reduce((s, i) => s + i.advances_deducted, 0);
    const totalDeductions = run.items.reduce((s, i) => s + i.other_deductions, 0);
    const totalBonuses = run.items.reduce((s, i) => s + i.bonuses, 0);

    return (
        <Box>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
                <IconButton onClick={() => navigate('/payroll')} aria-label={t('actions.cancel')}>
                    <ArrowBackIcon />
                </IconButton>
                <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.9) }}>
                    <PaymentsOutlinedIcon />
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="h5" fontWeight={800} noWrap>
                        {run.employee_name ?? `${months[run.period_month - 1]} ${run.period_year}`}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {run.period_date
                            ? `${formatDate(run.period_date, 'en')} · ${formatDate(run.period_date, 'prs')} ${t('calendar.hijri_shamsi')}`
                            : `${months[run.period_month - 1]} ${run.period_year}`}
                    </Typography>
                </Box>
                <Chip
                    color={run.status === 'paid' ? 'success' : 'default'}
                    variant={run.status === 'paid' ? 'filled' : 'outlined'}
                    label={t(`status.${run.status}`)}
                    sx={{ fontWeight: 700, height: 32 }}
                />
            </Stack>

            {/* Actions */}
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center" sx={{ mb: 2 }}>
                <DocumentActions
                    onPrint={() => openPdf(true)}
                    onPdf={() => openPdf(false)}
                    onWhatsApp={shareWhatsApp}
                    busy={busyPdf}
                />
                <Box sx={{ flexGrow: 1 }} />
                {run.status === 'draft' && (
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <TextField
                            select
                            size="small"
                            label={t('fields.pay_from')}
                            value={payingCashAccountId}
                            onChange={(e) => setPayingCashAccountId(Number(e.target.value))}
                            sx={{ minWidth: 180 }}
                        >
                            {cashAccounts?.map((a) => (
                                <MenuItem key={a.id} value={a.id}>
                                    {a.name}
                                </MenuItem>
                            ))}
                        </TextField>
                        <LoadingButton
                            variant="contained"
                            color="success"
                            loading={payMutation.isPending}
                            disabled={!payingCashAccountId}
                            onClick={() => payMutation.mutate()}
                        >
                            {t('payroll_page.pay_run')}
                        </LoadingButton>
                    </Stack>
                )}
            </Stack>

            {/* Net pay hero */}
            <Paper
                sx={{
                    p: 3,
                    borderRadius: 3,
                    mb: 2.5,
                    color: '#fff',
                    background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
                }}
            >
                <Typography variant="overline" sx={{ opacity: 0.9 }}>
                    {t('fields.total_net_pay')}
                </Typography>
                <Typography variant="h3" fontWeight={800}>
                    {withSym(run.total_net_pay)}
                </Typography>
            </Paper>

            {/* Items */}
            <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ p: 2, pb: 1 }}>
                    {t('payroll_page.payslips')}
                </Typography>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                            <TableCell>{t('nav.employees')}</TableCell>
                            <TableCell align="right">{t('fields.base_salary')}</TableCell>
                            <TableCell align="right">{t('fields.advances_deducted')}</TableCell>
                            <TableCell align="right">{t('payroll_page.deductions')}</TableCell>
                            <TableCell align="right">{t('payroll_page.bonuses')}</TableCell>
                            <TableCell align="right">{t('fields.net_pay')}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {run.items.map((item) => (
                            <TableRow key={item.id} hover>
                                <TableCell>{item.employee_name}</TableCell>
                                <TableCell align="right">{money(item.base_salary)}</TableCell>
                                <TableCell align="right">{money(item.advances_deducted)}</TableCell>
                                <TableCell align="right">{money(item.other_deductions)}</TableCell>
                                <TableCell align="right">{money(item.bonuses)}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700 }}>
                                    {money(item.net_pay)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow sx={{ '& td': { fontWeight: 800, color: 'primary.dark', bgcolor: alpha(theme.palette.primary.main, 0.06), fontSize: 13 } }}>
                            <TableCell>{t('fields.grand_total')}</TableCell>
                            <TableCell align="right">{money(totalBase)}</TableCell>
                            <TableCell align="right">{money(totalAdvances)}</TableCell>
                            <TableCell align="right">{money(totalDeductions)}</TableCell>
                            <TableCell align="right">{money(totalBonuses)}</TableCell>
                            <TableCell align="right">{money(run.total_net_pay)}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </Paper>
        </Box>
    );
}
