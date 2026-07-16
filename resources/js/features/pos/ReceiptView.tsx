import { Box, Divider, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { SaleReceipt } from '@/features/pos/api';

interface ReceiptViewProps {
    sale: SaleReceipt;
}

export function ReceiptView({ sale }: ReceiptViewProps) {
    const { t } = useTranslation();

    return (
        <Box className="receipt-print" sx={{ maxWidth: 360, mx: 'auto', p: 2, fontFamily: 'monospace' }}>
            <Typography variant="h6" align="center">
                {t('app_name')}
            </Typography>
            <Typography variant="body2" align="center">
                {sale.invoice_number}
            </Typography>
            <Typography variant="body2" align="center" gutterBottom>
                {new Date(sale.sale_date).toLocaleString()}
            </Typography>
            <Typography variant="body2">Customer: {sale.customer_name}</Typography>
            <Divider sx={{ my: 1 }} />

            <Stack spacing={0.5}>
                {sale.items.map((item, idx) => (
                    <Stack key={idx} direction="row" justifyContent="space-between">
                        <Typography variant="body2">
                            {item.product_name} x{item.quantity}
                        </Typography>
                        <Typography variant="body2">{item.line_total.toFixed(2)}</Typography>
                    </Stack>
                ))}
            </Stack>

            <Divider sx={{ my: 1 }} />
            <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">Subtotal</Typography>
                <Typography variant="body2">{sale.subtotal.toFixed(2)}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
                <Typography variant="subtitle1" fontWeight="bold">
                    Total
                </Typography>
                <Typography variant="subtitle1" fontWeight="bold">
                    {sale.grand_total.toFixed(2)}
                </Typography>
            </Stack>
            <Divider sx={{ my: 1 }} />

            {sale.payments.map((payment, idx) => (
                <Stack key={idx} direction="row" justifyContent="space-between">
                    <Typography variant="body2">{payment.method}</Typography>
                    <Typography variant="body2">{payment.amount.toFixed(2)}</Typography>
                </Stack>
            ))}
            {sale.due_amount > 0 && (
                <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Due</Typography>
                    <Typography variant="body2">{sale.due_amount.toFixed(2)}</Typography>
                </Stack>
            )}

            <Typography variant="body2" align="center" sx={{ mt: 2 }}>
                {t('common.welcome')}
            </Typography>
        </Box>
    );
}
