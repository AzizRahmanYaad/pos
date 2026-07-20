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
import { AddPartyDialog } from '@/components/AddPartyDialog';
import { Can } from '@/components/Can';

export function SuppliersListPage() {
    const { t } = useTranslation();
    const { data, isLoading, isError } = useQuery({
        queryKey: ['suppliers'],
        queryFn: fetchSuppliers,
    });
    const [addOpen, setAddOpen] = useState(false);
    const [paying, setPaying] = useState<SupplierListItem | null>(null);

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4">{t('nav.suppliers')}</Typography>
                <Can permission="purchases.manage">
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
                                <TableCell>{t('nav.suppliers')}</TableCell>
                                <TableCell>{t('fields.phone')}</TableCell>
                                <TableCell align="right">{t('fields.balance')}</TableCell>
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
                                                {t('actions.pay')}
                                            </Button>
                                        </TableCell>
                                    </Can>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <AddPartyDialog kind="supplier" open={addOpen} onClose={() => setAddOpen(false)} />

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
