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
import AssignmentReturnOutlinedIcon from '@mui/icons-material/AssignmentReturnOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { useTranslation } from 'react-i18next';
import { downloadSaleInvoicePdf, fetchSale } from '@/features/sales/api';
import { fetchParty } from '@/features/parties/ledgerApi';
import { fetchBusinessSettings } from '@/features/settings/api';
import { formatDate } from '@/lib/calendar';
import { ReturnSaleDialog } from '@/features/sales/ReturnSaleDialog';

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
    completed: 'success',
    partially_refunded: 'warning',
    refunded: 'error',
    cancelled: 'default',
};

export function SaleDetailPage() {
    const { t, i18n } = useTranslation();
    const theme = useTheme();
    const navigate = useNavigate();
    const id = Number(useParams().id);
    const [busyPdf, setBusyPdf] = useState(false);
    const [returning, setReturning] = useState(false);

    const { data: sale, isLoading } = useQuery({
        queryKey: ['sale', id],
        queryFn: () => fetchSale(id),
    });

    const { data: settings } = useQuery({ queryKey: ['business-settings'], queryFn: fetchBusinessSettings });

    const money = (v: number) =>
        v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const openPdf = async (print: boolean) => {
        setBusyPdf(true);
        try {
            const { url } = await downloadSaleInvoicePdf(id);
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
        if (!sale) return;
        setBusyPdf(true);
        try {
            const { url, filename, blob } = await downloadSaleInvoicePdf(id);
            const message = t('sales_page.wa_message', {
                company: settings?.company_name ?? '',
                number: sale.invoice_number,
                total: money(sale.grand_total),
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

            let phone = '';
            if (sale.customer_id) {
                try {
                    const customer = await fetchParty('customer', sale.customer_id);
                    phone = (customer.phone ?? '').replace(/\D/g, '');
                } catch {
                    /* ignore */
                }
            }
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } finally {
            setBusyPdf(false);
        }
    };

    if (isLoading || !sale) {
        return (
            <Box sx={{ py: 6, textAlign: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    const canReturn = sale.status === 'completed' || sale.status === 'partially_refunded';

    return (
        <Box>
            {/* Header */}
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
                <IconButton onClick={() => navigate('/sales')} aria-label={t('actions.cancel')}>
                    <ArrowBackIcon />
                </IconButton>
                <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.9) }}>
                    <ReceiptLongOutlinedIcon />
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="h5" fontWeight={800} noWrap>
                        {sale.invoice_number}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {formatDate(sale.sale_date, i18n.language)}
                    </Typography>
                </Box>
                <Chip
                    color={STATUS_COLOR[sale.status] ?? 'default'}
                    variant="filled"
                    label={t(`status.${sale.status}`)}
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
                        <Button variant="outlined" startIcon={<PictureAsPdfOutlinedIcon />} disabled={busyPdf} onClick={() => openPdf(false)}>
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
                <Box sx={{ flexGrow: 1 }} />
                {canReturn && (
                    <Button
                        variant="contained"
                        color="error"
                        startIcon={<AssignmentReturnOutlinedIcon />}
                        onClick={() => setReturning(true)}
                    >
                        {t('sales_page.return')}
                    </Button>
                )}
            </Stack>

            <Grid container spacing={2.5}>
                {/* Meta */}
                <Grid item xs={12} md={4}>
                    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
                        <Typography variant="overline" color="text.secondary">
                            {t('nav.customers')}
                        </Typography>
                        <Typography variant="h6" fontWeight={700}>
                            {sale.customer_name}
                        </Typography>
                        <Divider sx={{ my: 1.5 }} />
                        <Stack spacing={1}>
                            <Stack direction="row" justifyContent="space-between">
                                <Typography variant="body2" color="text.secondary">
                                    {t('fields.warehouse')}
                                </Typography>
                                <Typography variant="body2">{sale.warehouse_name}</Typography>
                            </Stack>
                            <Stack direction="row" justifyContent="space-between">
                                <Typography variant="body2" color="text.secondary">
                                    {t('sales_page.cashier')}
                                </Typography>
                                <Typography variant="body2">{sale.cashier_name}</Typography>
                            </Stack>
                            <Stack direction="row" justifyContent="space-between">
                                <Typography variant="body2" color="text.secondary">
                                    {t('fields.date')}
                                </Typography>
                                <Typography variant="body2">{formatDate(sale.sale_date, i18n.language)}</Typography>
                            </Stack>
                        </Stack>
                    </Paper>
                </Grid>

                {/* Totals */}
                <Grid item xs={12} md={8}>
                    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
                        <Grid container spacing={1}>
                            <TotalRow label={t('fields.subtotal')} value={money(sale.subtotal)} />
                            {sale.discount > 0 && (
                                <TotalRow label={t('pos_page.discount')} value={`−${money(sale.discount)}`} />
                            )}
                            {sale.tax > 0 && <TotalRow label={t('purchases_page.tax')} value={money(sale.tax)} />}
                            <Grid item xs={12}>
                                <Divider sx={{ my: 1 }} />
                            </Grid>
                            <TotalRow label={t('fields.grand_total')} value={money(sale.grand_total)} bold />
                            {sale.paid_amount > 0 && (
                                <TotalRow label={t('fields.paid')} value={money(sale.paid_amount)} />
                            )}
                            {sale.due_amount > 0.005 && (
                                <TotalRow label={t('fields.due')} value={money(sale.due_amount)} />
                            )}
                        </Grid>
                        {sale.payments.length > 0 && (
                            <>
                                <Divider sx={{ my: 1.5 }} />
                                <Typography variant="caption" color="text.secondary">
                                    {t('sales_page.payments')}
                                </Typography>
                                <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                                    {sale.payments.map((payment) => (
                                        <Stack key={payment.id} direction="row" justifyContent="space-between">
                                            <Typography variant="body2" color="text.secondary">
                                                {t(`payment_methods.${payment.method}`, { defaultValue: payment.method })}
                                                {' — '}
                                                {payment.cash_account_name}
                                            </Typography>
                                            <Typography variant="body2">{money(payment.amount)}</Typography>
                                        </Stack>
                                    ))}
                                </Stack>
                            </>
                        )}
                    </Paper>
                </Grid>

                {/* Items */}
                <Grid item xs={12}>
                    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ p: 2, pb: 1 }}>
                            {t('purchases_page.items')}
                        </Typography>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                                    <TableCell>{t('fields.product')}</TableCell>
                                    <TableCell align="right">{t('fields.quantity')}</TableCell>
                                    <TableCell align="right">{t('fields.price')}</TableCell>
                                    <TableCell align="right">{t('fields.total')}</TableCell>
                                    <TableCell align="right">{t('sales_page.unit_cost')}</TableCell>
                                    <TableCell align="right">{t('purchases_page.total_cost')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {sale.items.map((item) => (
                                    <TableRow key={item.id} hover>
                                        <TableCell>
                                            {item.product_name}
                                            {item.refunded_quantity > 0 && (
                                                <Chip
                                                    size="small"
                                                    color="warning"
                                                    variant="outlined"
                                                    label={t('sales_page.returned_qty', { qty: item.refunded_quantity })}
                                                    sx={{ ml: 1, height: 20 }}
                                                />
                                            )}
                                        </TableCell>
                                        <TableCell align="right">{item.quantity}</TableCell>
                                        <TableCell align="right">{money(item.unit_price)}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                                            {money(item.line_total)}
                                        </TableCell>
                                        <TableCell align="right" sx={{ color: 'text.secondary' }}>
                                            {money(item.cost_price_snapshot)}
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700, color: 'primary.dark' }}>
                                            {money(item.total_cost)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Paper>
                </Grid>
            </Grid>

            <ReturnSaleDialog sale={returning ? sale : null} onClose={() => setReturning(false)} />
        </Box>
    );
}

function TotalRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
    return (
        <>
            <Grid item xs={6}>
                <Typography variant="body2" color={bold ? 'text.primary' : 'text.secondary'} fontWeight={bold ? 700 : 400}>
                    {label}
                </Typography>
            </Grid>
            <Grid item xs={6}>
                <Typography
                    variant={bold ? 'h6' : 'body2'}
                    align="right"
                    fontWeight={bold ? 800 : 500}
                    color={bold ? 'primary.dark' : 'text.primary'}
                >
                    {value}
                </Typography>
            </Grid>
        </>
    );
}
