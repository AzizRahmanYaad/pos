import { Box, Divider, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { SaleReceipt } from '@/features/pos/api';
import { formatDateLong } from '@/lib/calendar';
import { money } from '@/lib/money';

interface ReceiptViewProps {
    sale: SaleReceipt;
}

export function ReceiptView({ sale }: ReceiptViewProps) {
    const { t, i18n } = useTranslation();

    return (
        <Box className="receipt-print" sx={{ maxWidth: 360, mx: 'auto', p: 2, fontFamily: 'monospace' }}>
            <Typography variant="h6" align="center">
                {t('app_name')}
            </Typography>
            <Typography variant="body2" align="center">
                {sale.invoice_number}
            </Typography>
            <Typography variant="body2" align="center" gutterBottom>
                {formatDateLong(sale.sale_date, i18n.language)}
            </Typography>
            <Typography variant="body2">
                {t('receipt.customer')}: {sale.customer_name}
            </Typography>
            <Divider sx={{ my: 1 }} />

            <Stack spacing={0.5}>
                {sale.items.map((item, idx) => (
                    <Stack key={idx} direction="row" justifyContent="space-between">
                        <Typography variant="body2">
                            {item.product_name} x{item.quantity}
                        </Typography>
                        <Typography variant="body2">{money(item.line_total)}</Typography>
                    </Stack>
                ))}
            </Stack>

            <Divider sx={{ my: 1 }} />
            <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">{t('receipt.subtotal')}</Typography>
                <Typography variant="body2">{money(sale.subtotal)}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
                <Typography variant="subtitle1" fontWeight="bold">
                    {t('receipt.total')}
                </Typography>
                <Typography variant="subtitle1" fontWeight="bold">
                    {money(sale.grand_total)}
                </Typography>
            </Stack>
            <Divider sx={{ my: 1 }} />

            {sale.payments.map((payment, idx) => (
                <Stack key={idx} direction="row" justifyContent="space-between">
                    <Typography variant="body2">{t(`payment_methods.${payment.method}`)}</Typography>
                    <Typography variant="body2">{money(payment.amount)}</Typography>
                </Stack>
            ))}
            {sale.due_amount > 0 && (
                <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">{t('receipt.due')}</Typography>
                    <Typography variant="body2">{money(sale.due_amount)}</Typography>
                </Stack>
            )}

            <Typography variant="body2" align="center" sx={{ mt: 2 }}>
                {t('receipt.thank_you')}
            </Typography>
        </Box>
    );
}
