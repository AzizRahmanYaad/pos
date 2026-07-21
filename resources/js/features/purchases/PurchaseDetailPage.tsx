import { useState } from 'react';
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
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { useTranslation } from 'react-i18next';
import {
    cancelPurchase,
    downloadPurchaseInvoicePdf,
    fetchPurchase,
    receivePurchase,
} from '@/features/purchases/api';
import { fetchParty } from '@/features/parties/ledgerApi';
import { fetchBusinessSettings } from '@/features/settings/api';
import { formatDate } from '@/lib/calendar';

const STATUS_COLOR: Record<string, 'default' | 'success' | 'error'> = {
    draft: 'default',
    received: 'success',
    cancelled: 'error',
};

export function PurchaseDetailPage() {
    const { t, i18n } = useTranslation();
    const theme = useTheme();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const id = Number(useParams().id);
    const [busyPdf, setBusyPdf] = useState(false);

    const { data: purchase, isLoading } = useQuery({
        queryKey: ['purchase', id],
        queryFn: () => fetchPurchase(id),
    });

    const { data: settings } = useQuery({ queryKey: ['business-settings'], queryFn: fetchBusinessSettings });

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['purchase', id] });
        queryClient.invalidateQueries({ queryKey: ['purchases-page'] });
    };
    const receiveMutation = useMutation({ mutationFn: () => receivePurchase(id), onSuccess: invalidate });
    const cancelMutation = useMutation({ mutationFn: () => cancelPurchase(id), onSuccess: invalidate });

    const money = (v: number) =>
        v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const openPdf = async (print: boolean) => {
        setBusyPdf(true);
        try {
            const { url } = await downloadPurchaseInvoicePdf(id);
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
        if (!purchase) return;
        setBusyPdf(true);
        try {
            const { url, filename, blob } = await downloadPurchaseInvoicePdf(id);
            const message = t('purchases_page.wa_message', {
                company: settings?.company_name ?? '',
                number: purchase.purchase_number,
                total: money(purchase.grand_total),
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

            // Best-effort: open a WhatsApp chat with the supplier if we can
            // resolve their phone number.
            let phone = '';
            try {
                const supplier = await fetchParty('supplier', purchase.supplier_id);
                phone = (supplier.phone ?? '').replace(/\D/g, '');
            } catch {
                /* ignore */
            }
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } finally {
            setBusyPdf(false);
        }
    };

    if (isLoading || !purchase) {
        return (
            <Box sx={{ py: 6, textAlign: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            {/* Header */}
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
                <IconButton onClick={() => navigate('/purchases')} aria-label={t('actions.cancel')}>
                    <ArrowBackIcon />
                </IconButton>
                <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.9) }}>
                    <ReceiptLongOutlinedIcon />
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="h5" fontWeight={800} noWrap>
                        {purchase.purchase_number}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {formatDate(purchase.purchase_date, i18n.language)}
                    </Typography>
                </Box>
                <Chip
                    color={STATUS_COLOR[purchase.status]}
                    variant={purchase.status === 'draft' ? 'outlined' : 'filled'}
                    label={t(`status.${purchase.status}`)}
                    sx={{ fontWeight: 700, height: 32 }}
                />
            </Stack>

            {/* Actions */}
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                <Button
                    variant="outlined"
                    startIcon={<PrintOutlinedIcon />}
                    disabled={busyPdf}
                    onClick={() => openPdf(true)}
                >
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
                <Box sx={{ flexGrow: 1 }} />
                {purchase.status === 'draft' && (
                    <>
                        <Button
                            variant="contained"
                            color="success"
                            startIcon={<CheckCircleOutlineIcon />}
                            disabled={receiveMutation.isPending}
                            onClick={() => receiveMutation.mutate()}
                        >
                            {t('actions.receive')}
                        </Button>
                        <Button
                            variant="outlined"
                            color="error"
                            startIcon={<CancelOutlinedIcon />}
                            disabled={cancelMutation.isPending}
                            onClick={() => cancelMutation.mutate()}
                        >
                            {t('actions.cancel')}
                        </Button>
                    </>
                )}
            </Stack>

            <Grid container spacing={2.5}>
                {/* Meta */}
                <Grid item xs={12} md={4}>
                    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
                        <Typography variant="overline" color="text.secondary">
                            {t('nav.suppliers')}
                        </Typography>
                        <Typography variant="h6" fontWeight={700}>
                            {purchase.supplier_name}
                        </Typography>
                        <Divider sx={{ my: 1.5 }} />
                        <Stack spacing={1}>
                            <Stack direction="row" justifyContent="space-between">
                                <Typography variant="body2" color="text.secondary">
                                    {t('fields.warehouse')}
                                </Typography>
                                <Typography variant="body2">{purchase.warehouse_name}</Typography>
                            </Stack>
                            <Stack direction="row" justifyContent="space-between">
                                <Typography variant="body2" color="text.secondary">
                                    {t('fields.date')}
                                </Typography>
                                <Typography variant="body2">
                                    {formatDate(purchase.purchase_date, i18n.language)}
                                </Typography>
                            </Stack>
                        </Stack>
                    </Paper>
                </Grid>

                {/* Totals */}
                <Grid item xs={12} md={8}>
                    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
                        <Grid container spacing={1}>
                            <TotalRow label={t('fields.subtotal')} value={money(purchase.subtotal)} />
                            {purchase.discount > 0 && (
                                <TotalRow label={t('pos_page.discount')} value={`−${money(purchase.discount)}`} />
                            )}
                            {purchase.tax > 0 && <TotalRow label={t('purchases_page.tax')} value={money(purchase.tax)} />}
                            {purchase.landed_cost_total > 0 && (
                                <TotalRow
                                    label={t('purchases_page.landed_cost')}
                                    value={money(purchase.landed_cost_total)}
                                />
                            )}
                            <Grid item xs={12}>
                                <Divider sx={{ my: 1 }} />
                            </Grid>
                            <TotalRow
                                label={t('fields.grand_total')}
                                value={money(purchase.grand_total)}
                                bold
                            />
                            <TotalRow label={t('fields.due')} value={money(purchase.due_amount)} />
                        </Grid>
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
                                    <TableCell align="right">{t('fields.unit_cost')}</TableCell>
                                    <TableCell align="right">{t('fields.total')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {purchase.items.map((item) => (
                                    <TableRow key={item.id} hover>
                                        <TableCell>{item.product_name}</TableCell>
                                        <TableCell align="right">{item.quantity}</TableCell>
                                        <TableCell align="right">{money(item.unit_cost)}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                                            {money(item.line_total)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {purchase.landed_costs.map((cost) => (
                                    <TableRow key={`lc-${cost.id}`}>
                                        <TableCell colSpan={3} sx={{ color: 'text.secondary' }}>
                                            {t('purchases_page.landed_cost')}: {cost.description}
                                        </TableCell>
                                        <TableCell align="right">{money(cost.amount)}</TableCell>
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
