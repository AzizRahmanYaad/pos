import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import { useTranslation } from 'react-i18next';
import {
    fetchEmployee,
    fetchEmployeeLedger,
    downloadEmployeeStatementPdf,
} from '@/features/employees/api';
import { fetchBusinessSettings } from '@/features/settings/api';

export function EmployeeDetailPage() {
    const { t } = useTranslation();
    const theme = useTheme();
    const navigate = useNavigate();
    const id = Number(useParams().id);
    const [busyPdf, setBusyPdf] = useState(false);

    const { data: employee, isLoading } = useQuery({
        queryKey: ['employee', id],
        queryFn: () => fetchEmployee(id),
    });
    const { data: ledger } = useQuery({
        queryKey: ['employee-ledger', id],
        queryFn: () => fetchEmployeeLedger(id),
    });
    const { data: settings } = useQuery({ queryKey: ['business-settings'], queryFn: fetchBusinessSettings });

    const money = (v: number) =>
        v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const sym = settings?.currency_symbol ?? '';
    const withSym = (v: number) => `${money(v)}${sym ? ` ${sym}` : ''}`;

    const openPdf = async (print: boolean) => {
        setBusyPdf(true);
        try {
            const { url } = await downloadEmployeeStatementPdf(id);
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
        if (!employee) return;
        setBusyPdf(true);
        try {
            const { url, filename, blob } = await downloadEmployeeStatementPdf(id);
            const message = t('employees_page.wa_message', {
                company: settings?.company_name ?? '',
                name: employee.name,
                advances: withSym(employee.outstanding_advances),
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
            const phone = (employee.phone ?? '').replace(/\D/g, '');
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } finally {
            setBusyPdf(false);
        }
    };

    if (isLoading || !employee) {
        return (
            <Box sx={{ py: 6, textAlign: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
                <IconButton onClick={() => navigate('/employees')} aria-label={t('actions.cancel')}>
                    <ArrowBackIcon />
                </IconButton>
                <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.9) }}>
                    <BadgeOutlinedIcon />
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="h5" fontWeight={800} noWrap>
                        {employee.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {employee.designation ?? '—'}
                    </Typography>
                </Box>
                <Chip
                    color={employee.is_active ? 'success' : 'default'}
                    variant={employee.is_active ? 'filled' : 'outlined'}
                    label={t(`status.${employee.is_active ? 'active' : 'inactive'}`)}
                    sx={{ fontWeight: 700, height: 32 }}
                />
            </Stack>

            {/* Actions */}
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                <Button variant="outlined" startIcon={<PrintOutlinedIcon />} disabled={busyPdf} onClick={() => openPdf(true)}>
                    {t('purchases_page.print')}
                </Button>
                <Tooltip title={t('ledger.download_pdf')}>
                    <span>
                        <Button
                            variant="outlined"
                            startIcon={<PictureAsPdfOutlinedIcon />}
                            disabled={busyPdf}
                            onClick={() => openPdf(false)}
                        >
                            PDF
                        </Button>
                    </span>
                </Tooltip>
                <Button
                    variant="contained"
                    startIcon={<WhatsAppIcon />}
                    disabled={busyPdf}
                    onClick={shareWhatsApp}
                    sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#1da851' } }}
                >
                    {t('ledger.whatsapp')}
                </Button>
            </Stack>

            <Grid container spacing={2.5}>
                {/* Meta */}
                <Grid item xs={12} md={4}>
                    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
                        <Stack spacing={1.25}>
                            <Row label={t('fields.salary')} value={`${withSym(employee.salary_amount)} / ${t(`fields.salary_type_${employee.salary_type}`)}`} />
                            <Divider />
                            <Row label={t('fields.phone')} value={employee.phone ?? '—'} />
                            <Divider />
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="body2" color="text.secondary">
                                    {t('fields.outstanding_advances')}
                                </Typography>
                                {employee.outstanding_advances > 0 ? (
                                    <Chip size="small" color="warning" label={withSym(employee.outstanding_advances)} />
                                ) : (
                                    <Typography variant="body2">—</Typography>
                                )}
                            </Stack>
                        </Stack>
                    </Paper>
                </Grid>

                {/* Ledger */}
                <Grid item xs={12} md={8}>
                    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', height: '100%' }}>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ p: 2, pb: 1 }}>
                            {t('employees_page.transactions')}
                        </Typography>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                                    <TableCell>{t('fields.date')}</TableCell>
                                    <TableCell>{t('fields.description')}</TableCell>
                                    <TableCell align="right">{t('ledger.debit')}</TableCell>
                                    <TableCell align="right">{t('ledger.credit')}</TableCell>
                                    <TableCell align="right">{t('ledger.balance')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {ledger?.entries.map((entry) => (
                                    <TableRow key={entry.id} hover>
                                        <TableCell>{entry.transaction_date?.slice(0, 10)}</TableCell>
                                        <TableCell>{entry.description ?? '—'}</TableCell>
                                        <TableCell align="right" sx={{ color: 'error.main' }}>
                                            {entry.entry_type === 'debit' ? money(entry.amount) : ''}
                                        </TableCell>
                                        <TableCell align="right" sx={{ color: 'success.main' }}>
                                            {entry.entry_type === 'credit' ? money(entry.amount) : ''}
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                                            {money(entry.running_balance)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {ledger && ledger.entries.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5}>
                                            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                                {t('employees_page.no_transactions')}
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

function Row({ label, value }: { label: string; value: string }) {
    return (
        <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" color="text.secondary">
                {label}
            </Typography>
            <Typography variant="body2" fontWeight={600} sx={{ textAlign: 'right' }}>
                {value}
            </Typography>
        </Stack>
    );
}
