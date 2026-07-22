import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    TextField,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { LoadingButton } from '@/components/LoadingButton';
import { createCustomer } from '@/features/customers/api';
import { createSupplier } from '@/features/suppliers/api';

interface AddPartyDialogProps {
    kind: 'customer' | 'supplier';
    open: boolean;
    onClose: () => void;
}

/**
 * Create dialog shared by the customers and suppliers pages. An opening
 * balance is recorded as a debit for customers (they owe the shop) and a
 * credit for suppliers (the shop owes them).
 */
export function AddPartyDialog({ kind, open, onClose }: AddPartyDialogProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [openingBalance, setOpeningBalance] = useState('');
    const [creditLimit, setCreditLimit] = useState('');
    const [error, setError] = useState<string | null>(null);

    const close = () => {
        setName('');
        setPhone('');
        setAddress('');
        setOpeningBalance('');
        setCreditLimit('');
        setError(null);
        onClose();
    };

    const mutation = useMutation({
        mutationFn: () => {
            const base = {
                name,
                phone: phone || undefined,
                address: address || undefined,
                opening_balance: openingBalance ? Number(openingBalance) : undefined,
                opening_balance_type: (kind === 'customer' ? 'debit' : 'credit') as
                    | 'debit'
                    | 'credit',
            };

            return kind === 'customer'
                ? createCustomer({
                      ...base,
                      credit_limit: creditLimit ? Number(creditLimit) : undefined,
                  })
                : createSupplier(base);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [kind === 'customer' ? 'customers' : 'suppliers'],
            });
            close();
        },
        onError: () => setError(t('parties.create_failed')),
    });

    return (
        <Dialog open={open} onClose={close} fullWidth maxWidth="xs">
            <DialogTitle>
                {kind === 'customer' ? t('parties.new_customer') : t('parties.new_supplier')}
            </DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    {error && <Alert severity="error">{error}</Alert>}
                    <TextField
                        label={t('fields.name')}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        fullWidth
                        autoFocus
                    />
                    <TextField
                        label={t('fields.phone')}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        fullWidth
                    />
                    <TextField
                        label={t('parties.address')}
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        fullWidth
                    />
                    <TextField
                        label={t('parties.opening_balance')}
                        type="number"
                        value={openingBalance}
                        onChange={(e) => setOpeningBalance(e.target.value)}
                        helperText={
                            kind === 'customer'
                                ? t('parties.opening_balance_hint_customer')
                                : t('parties.opening_balance_hint_supplier')
                        }
                        fullWidth
                    />
                    {kind === 'customer' && (
                        <TextField
                            label={t('parties.credit_limit')}
                            type="number"
                            value={creditLimit}
                            onChange={(e) => setCreditLimit(e.target.value)}
                            fullWidth
                        />
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={close}>{t('actions.cancel')}</Button>
                <LoadingButton
                    variant="contained"
                    loading={mutation.isPending}
                    disabled={!name}
                    onClick={() => mutation.mutate()}
                >
                    {t('actions.save')}
                </LoadingButton>
            </DialogActions>
        </Dialog>
    );
}
