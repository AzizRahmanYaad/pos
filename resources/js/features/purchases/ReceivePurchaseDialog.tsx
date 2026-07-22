import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    InputAdornment,
    MenuItem,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { fetchCashAccounts } from '@/features/cash-accounts/api';
import { receivePurchase, type ReceivePurchasePayment } from '@/features/purchases/api';

interface ReceivePurchaseDialogProps {
    purchase: { id: number; grand_total: number } | null;
    onClose: () => void;
    invalidateQueryKey: string | string[];
}

const METHODS: ReceivePurchasePayment['method'][] = ['cash', 'card', 'mobile_wallet', 'bank'];

export function ReceivePurchaseDialog({ purchase, onClose, invalidateQueryKey }: ReceivePurchaseDialogProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { data: cashAccounts } = useQuery({ queryKey: ['cash-accounts'], queryFn: fetchCashAccounts });

    const [amount, setAmount] = useState('');
    const [cashAccountId, setCashAccountId] = useState<number | ''>('');
    const [method, setMethod] = useState<ReceivePurchasePayment['method']>('cash');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (purchase) {
            setAmount('');
            setCashAccountId('');
            setMethod('cash');
            setError(null);
        }
    }, [purchase]);

    const mutation = useMutation({
        mutationFn: () => {
            const paid = Number(amount || 0);
            return receivePurchase(
                purchase!.id,
                paid > 0 ? { amount: paid, cash_account_id: cashAccountId as number, method } : undefined,
            );
        },
        onSuccess: () => {
            const keys = Array.isArray(invalidateQueryKey) ? invalidateQueryKey : [invalidateQueryKey];
            keys.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['products-page'] });
            onClose();
        },
        onError: () => setError(t('purchases_page.receive_failed')),
    });

    if (!purchase) return null;

    const paidNow = Number(amount || 0);
    const canSubmit = paidNow <= 0 || cashAccountId !== '';

    return (
        <Dialog open onClose={onClose} fullWidth maxWidth="xs">
            <DialogTitle>{t('actions.receive')}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    {error && <Alert severity="error">{error}</Alert>}
                    <Typography variant="body2" color="text.secondary">
                        {t('purchases_page.receive_pay_hint', {
                            amount: purchase.grand_total.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            }),
                        })}
                    </Typography>
                    <TextField
                        label={t('purchases_page.pay_now')}
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        fullWidth
                        autoFocus
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <Button size="small" onClick={() => setAmount(String(purchase.grand_total))}>
                                        {t('payments_dialog.pay_full')}
                                    </Button>
                                </InputAdornment>
                            ),
                        }}
                    />
                    {paidNow > 0 && (
                        <>
                            <TextField
                                select
                                label={t('fields.cash_account')}
                                value={cashAccountId}
                                onChange={(e) => setCashAccountId(Number(e.target.value))}
                                fullWidth
                            >
                                {cashAccounts?.map((account) => (
                                    <MenuItem key={account.id} value={account.id}>
                                        {account.name}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                select
                                label={t('fields.method')}
                                value={method}
                                onChange={(e) => setMethod(e.target.value as ReceivePurchasePayment['method'])}
                                fullWidth
                            >
                                {METHODS.map((m) => (
                                    <MenuItem key={m} value={m}>
                                        {t(`payment_methods.${m}`)}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('actions.cancel')}</Button>
                <Button
                    variant="contained"
                    color="success"
                    disabled={!canSubmit || mutation.isPending}
                    onClick={() => mutation.mutate()}
                >
                    {t('actions.receive')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
