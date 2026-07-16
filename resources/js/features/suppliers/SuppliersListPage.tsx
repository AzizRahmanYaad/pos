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
import { fetchSuppliers, type SupplierListItem } from '@/features/suppliers/api';
import { PaymentDialog } from '@/features/payments/PaymentDialog';
import { Can } from '@/components/Can';

export function SuppliersListPage() {
    const { t } = useTranslation();
    const { data, isLoading, isError } = useQuery({
        queryKey: ['suppliers'],
        queryFn: fetchSuppliers,
    });
    const [paying, setPaying] = useState<SupplierListItem | null>(null);

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                {t('nav.suppliers')}
            </Typography>

            {isLoading && <CircularProgress />}
            {isError && <Alert severity="error">{t('common.loading')}</Alert>}

            {data && (
                <TableContainer component={Paper}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('nav.suppliers')}</TableCell>
                                <TableCell>Phone</TableCell>
                                <TableCell align="right">Balance</TableCell>
                                <Can permission="payments.manage">
                                    <TableCell align="right"> </TableCell>
                                </Can>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {data.map((supplier) => (
                                <TableRow key={supplier.id}>
                                    <TableCell>{supplier.name}</TableCell>
                                    <TableCell>{supplier.phone ?? '—'}</TableCell>
                                    <TableCell align="right">
                                        <Chip
                                            size="small"
                                            color={supplier.current_balance < 0 ? 'warning' : 'default'}
                                            label={supplier.current_balance.toFixed(2)}
                                        />
                                    </TableCell>
                                    <Can permission="payments.manage">
                                        <TableCell align="right">
                                            <Button size="small" onClick={() => setPaying(supplier)}>
                                                Pay
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
                    partyType="supplier"
                    partyId={paying.id}
                    partyName={paying.name}
                    invalidateQueryKey="suppliers"
                />
            )}
        </Box>
    );
}
