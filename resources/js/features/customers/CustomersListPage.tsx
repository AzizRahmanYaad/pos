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
import { Can } from '@/components/Can';

export function CustomersListPage() {
    const { t } = useTranslation();
    const { data, isLoading, isError } = useQuery({
        queryKey: ['customers'],
        queryFn: fetchCustomers,
    });
    const [paying, setPaying] = useState<CustomerListItem | null>(null);

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                {t('nav.customers')}
            </Typography>

            {isLoading && <CircularProgress />}
            {isError && <Alert severity="error">{t('common.loading')}</Alert>}

            {data && (
                <TableContainer component={Paper}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('nav.customers')}</TableCell>
                                <TableCell>Phone</TableCell>
                                <TableCell align="right">Balance</TableCell>
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
                                                Receive payment
                                            </Button>
                                        </TableCell>
                                    </Can>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

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
