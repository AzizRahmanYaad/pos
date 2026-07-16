import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchPurchases, receivePurchase, cancelPurchase } from '@/features/purchases/api';

const STATUS_COLOR: Record<string, 'default' | 'success' | 'error'> = {
    draft: 'default',
    received: 'success',
    cancelled: 'error',
};

export function PurchasesListPage() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { data, isLoading, isError } = useQuery({
        queryKey: ['purchases'],
        queryFn: fetchPurchases,
    });

    const receiveMutation = useMutation({
        mutationFn: receivePurchase,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchases'] }),
    });
    const cancelMutation = useMutation({
        mutationFn: cancelPurchase,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchases'] }),
    });

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4">{t('nav.purchases')}</Typography>
                <Button variant="contained" component={RouterLink} to="/purchases/new">
                    {t('actions.add')}
                </Button>
            </Box>

            {isLoading && <CircularProgress />}
            {isError && <Alert severity="error">{t('common.loading')}</Alert>}

            {data && (
                <TableContainer component={Paper}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>#</TableCell>
                                <TableCell>{t('nav.suppliers')}</TableCell>
                                <TableCell>{t('nav.inventory')}</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell align="right">Grand Total</TableCell>
                                <TableCell align="right"> </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {data.map((purchase) => (
                                <TableRow key={purchase.id}>
                                    <TableCell>{purchase.purchase_number}</TableCell>
                                    <TableCell>{purchase.supplier_name}</TableCell>
                                    <TableCell>{purchase.warehouse_name}</TableCell>
                                    <TableCell>
                                        <Chip size="small" color={STATUS_COLOR[purchase.status]} label={purchase.status} />
                                    </TableCell>
                                    <TableCell align="right">{purchase.grand_total.toFixed(2)}</TableCell>
                                    <TableCell align="right">
                                        {purchase.status === 'draft' && (
                                            <>
                                                <Button
                                                    size="small"
                                                    disabled={receiveMutation.isPending}
                                                    onClick={() => receiveMutation.mutate(purchase.id)}
                                                >
                                                    Receive
                                                </Button>
                                                <Button
                                                    size="small"
                                                    color="error"
                                                    disabled={cancelMutation.isPending}
                                                    onClick={() => cancelMutation.mutate(purchase.id)}
                                                >
                                                    {t('actions.cancel')}
                                                </Button>
                                            </>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );
}
