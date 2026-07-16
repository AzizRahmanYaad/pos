import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    MenuItem,
    Stack,
    TextField,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { fetchCashAccounts } from '@/features/cash-accounts/api';
import { recordPayment, type RecordPaymentPayload } from '@/features/payments/api';

interface PaymentDialogProps {
    open: boolean;
    onClose: () => void;
    partyType: 'customer' | 'supplier';
    partyId: number;
    partyName: string;
    invalidateQueryKey: string;
}

const METHODS: RecordPaymentPayload['method'][] = ['cash', 'card', 'mobile_wallet', 'bank'];

export function PaymentDialog({ open, onClose, partyType, partyId, partyName, invalidateQueryKey }: PaymentDialogProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { data: cashAccounts } = useQuery({ queryKey: ['cash-accounts'], queryFn: fetchCashAccounts });

    const [amount, setAmount] = useState('');
    const [cashAccountId, setCashAccountId] = useState<number | ''>('');
    const [method, setMethod] = useState<RecordPaymentPayload['method']>('cash');
    const [description, setDescription] = useState('');
    const [error, setError] = useState<string | null>(null);

    const direction = partyType === 'customer' ? 'in' : 'out';

    const mutation = useMutation({
        mutationFn: recordPayment,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [invalidateQueryKey] });
            setAmount('');
            setDescription('');
            setError(null);
            onClose();
        },
        onError: () => setError('Could not record payment.'),
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
        });
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
            <DialogTitle>
                {direction === 'in' ? 'Receive payment' : 'Pay'} — {partyName}
            </DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    {error && <Alert severity="error">{error}</Alert>}
                    <TextField
                        label="Amount"
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        fullWidth
                        autoFocus
                    />
                    <TextField
                        select
                        label="Cash account"
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
                        label="Method"
                        value={method}
                        onChange={(e) => setMethod(e.target.value as RecordPaymentPayload['method'])}
                        fullWidth
                    >
                        {METHODS.map((m) => (
                            <MenuItem key={m} value={m}>
                                {m}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        label="Description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        fullWidth
                    />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('actions.cancel')}</Button>
                <Button
                    variant="contained"
                    onClick={submit}
                    disabled={mutation.isPending || !amount || !cashAccountId}
                >
                    {t('actions.save')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
