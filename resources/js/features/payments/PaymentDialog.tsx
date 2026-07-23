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
import { recordPayment, type RecordPaymentPayload } from '@/features/payments/api';
import { LoadingButton } from '@/components/LoadingButton';

interface PaymentDialogProps {
    open: boolean;
    onClose: () => void;
    partyType: 'customer' | 'supplier';
    partyId: number;
    partyName: string;
    invalidateQueryKey: string | string[];
    /** Ties the payment to a specific purchase/sale so its paid/due amounts update. */
    referenceType?: 'purchase' | 'sale';
    referenceId?: number;
    /** Outstanding balance on the reference — prefills the amount and shows a hint. */
    dueAmount?: number;
}

const METHODS: RecordPaymentPayload['method'][] = ['cash', 'card', 'mobile_wallet', 'bank'];

export function PaymentDialog({
    open,
    onClose,
    partyType,
    partyId,
    partyName,
    invalidateQueryKey,
    referenceType,
    referenceId,
    dueAmount,
}: PaymentDialogProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { data: cashAccounts } = useQuery({ queryKey: ['cash-accounts'], queryFn: fetchCashAccounts });

    const [amount, setAmount] = useState('');
    const [cashAccountId, setCashAccountId] = useState<number | ''>('');
    const [method, setMethod] = useState<RecordPaymentPayload['method']>('cash');
    const [description, setDescription] = useState('');
    const [error, setError] = useState<string | null>(null);

    const direction = partyType === 'customer' ? 'in' : 'out';

    useEffect(() => {
        if (open) {
            setAmount(dueAmount && dueAmount > 0 ? String(dueAmount) : '');
            setDescription('');
            setError(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const mutation = useMutation({
        mutationFn: recordPayment,
        meta: {
            successMessage:
                partyType === 'customer'
                    ? t('payments_dialog.receive_success')
                    : t('payments_dialog.pay_success'),
        },
        onSuccess: () => {
            const keys = Array.isArray(invalidateQueryKey) ? invalidateQueryKey : [invalidateQueryKey];
            keys.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
            queryClient.invalidateQueries({ queryKey: ['cash-accounts'] });
            setAmount('');
            setDescription('');
            setError(null);
            onClose();
        },
        onError: () => setError(t('payments_dialog.save_failed')),
    });

    const submit = () => {
        if (!amount || !cashAccountId) return;
        mutation.mutate({
            party_type: partyType,
            party_id: partyId,
            direction,
            amount: Number(amount),
            cash_account_id: cashAccountId,
            method,
            description: description || undefined,
            reference_type: referenceType,
            reference_id: referenceId,
        });
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
            <DialogTitle>
                {direction === 'in' ? t('payments_dialog.receive_payment') : t('actions.pay')} — {partyName}
            </DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    {error && <Alert severity="error">{error}</Alert>}
                    {dueAmount !== undefined && dueAmount > 0 && (
                        <Typography variant="caption" color="text.secondary">
                            {t('payments_dialog.amount_due', {
                                amount: dueAmount.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                }),
                            })}
                        </Typography>
                    )}
                    <TextField
                        label={t('fields.amount')}
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        fullWidth
                        autoFocus
                        InputProps={
                            dueAmount !== undefined && dueAmount > 0
                                ? {
                                      endAdornment: (
                                          <InputAdornment position="end">
                                              <Button
                                                  size="small"
                                                  onClick={() => setAmount(String(dueAmount))}
                                              >
                                                  {t('payments_dialog.pay_full')}
                                              </Button>
                                          </InputAdornment>
                                      ),
                                  }
                                : undefined
                        }
                    />
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
                        onChange={(e) => setMethod(e.target.value as RecordPaymentPayload['method'])}
                        fullWidth
                    >
                        {METHODS.map((m) => (
                            <MenuItem key={m} value={m}>
                                {t(`payment_methods.${m}`)}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        label={t('fields.description')}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        fullWidth
                    />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('actions.cancel')}</Button>
                <LoadingButton
                    variant="contained"
                    onClick={submit}
                    loading={mutation.isPending}
                    disabled={!amount || !cashAccountId}
                >
                    {t('actions.save')}
                </LoadingButton>
            </DialogActions>
        </Dialog>
    );
}
