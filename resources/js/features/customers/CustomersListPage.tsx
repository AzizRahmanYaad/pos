import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { fetchCustomers, type CustomerListItem } from '@/features/customers/api';
import { PaymentDialog } from '@/features/payments/PaymentDialog';
import { AddPartyDialog } from '@/components/AddPartyDialog';
import { Can } from '@/components/Can';

export function CustomersListPage() {
    const { t } = useTranslation();
    const { data, isLoading, isError } = useQuery({
        queryKey: ['customers'],
        queryFn: fetchCustomers,
    });
    const [addOpen, setAddOpen] = useState(false);
    const [paying, setPaying] = useState<CustomerListItem | null>(null);

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4">{t('nav.customers')}</Typography>
                <Can permission="sales.manage">
                    <Button variant="contained" onClick={() => setAddOpen(true)}>
                        {t('actions.add')}
                    </Button>
                </Can>
            </Box>

            {isLoading && <CircularProgress />}
            {isError && <Alert severity="error">{t('common.loading')}</Alert>}

            {data && (
                <TableContainer component={Paper}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('nav.customers')}</TableCell>
                                <TableCell>{t('fields.phone')}</TableCell>
                                <TableCell align="right">{t('fields.balance')}</TableCell>
                                <Can permission="payments.manage">
                                    <TableCell align="right"> </TableCell>
                                </Can>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {data.map((customer) => (
                                <TableRow key={customer.id}>
                                    <TableCell>{customer.name}</TableCell>
                                    <TableCell>{customer.phone ?? '—'}</TableCell>
                                    <TableCell align="right">
                                        <Chip
                                            size="small"
                                            color={customer.current_balance > 0 ? 'warning' : 'default'}
                                            label={customer.current_balance.toFixed(2)}
                                        />
                                    </TableCell>
                                    <Can permission="payments.manage">
                                        <TableCell align="right">
                                            <Button size="small" onClick={() => setPaying(customer)}>
                                                {t('payments_dialog.receive_payment')}
                                            </Button>
                                        </TableCell>
                                    </Can>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <AddPartyDialog kind="customer" open={addOpen} onClose={() => setAddOpen(false)} />

            {paying && (
                <PaymentDialog
                    open
                    onClose={() => setPaying(null)}
                    partyType="customer"
                    partyId={paying.id}
                    partyName={paying.name}
                    invalidateQueryKey="customers"
                />
            )}
        </Box>
    );
}
