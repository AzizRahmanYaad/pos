import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    MenuItem,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { fetchProducts, type ProductListItem } from '@/features/products/api';
import { createStockAdjustment } from '@/features/inventory/api';
import { AddProductDialog } from '@/features/products/AddProductDialog';
import { Can } from '@/components/Can';

export function ProductsListPage() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { data, isLoading, isError } = useQuery({
        queryKey: ['products'],
        queryFn: fetchProducts,
    });

    const [addOpen, setAddOpen] = useState(false);
    const [adjusting, setAdjusting] = useState<ProductListItem | null>(null);
    const [warehouseId, setWarehouseId] = useState<number | ''>('');
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [error, setError] = useState<string | null>(null);

    const mutation = useMutation({
        mutationFn: createStockAdjustment,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            closeDialog();
        },
        onError: () => setError(t('products_page.adjustment_failed')),
    });

    const openDialog = (product: ProductListItem) => {
        setAdjusting(product);
        setWarehouseId(product.stocks[0]?.warehouse_id ?? '');
        setQuantity('');
        setReason('');
        setError(null);
    };

    const closeDialog = () => setAdjusting(null);

    const submitAdjustment = () => {
        if (!adjusting || warehouseId === '' || !quantity || !reason) return;
        mutation.mutate({
            product_id: adjusting.id,
            warehouse_id: warehouseId,
            quantity: Number(quantity),
            reason,
        });
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4">{t('nav.products')}</Typography>
                <Can permission="products.manage">
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
                                <TableCell>{t('fields.sku')}</TableCell>
                                <TableCell>{t('nav.products')}</TableCell>
                                <TableCell>{t('fields.category')}</TableCell>
                                <TableCell align="right">{t('fields.stock')}</TableCell>
                                <TableCell align="right">{t('fields.price')}</TableCell>
                                <Can permission="inventory.manage">
                                    <TableCell align="right"> </TableCell>
                                </Can>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {data.map((product) => (
                                <TableRow key={product.id}>
                                    <TableCell>{product.sku}</TableCell>
                                    <TableCell>{product.name}</TableCell>
                                    <TableCell>{product.category_name ?? '—'}</TableCell>
                                    <TableCell align="right">
                                        {product.total_stock} {product.unit_short_name}
                                    </TableCell>
                                    <TableCell align="right">{product.sale_price.toFixed(2)}</TableCell>
                                    <Can permission="inventory.manage">
                                        <TableCell align="right">
                                            <Button size="small" onClick={() => openDialog(product)}>
                                                {t('actions.adjust')}
                                            </Button>
                                        </TableCell>
                                    </Can>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <AddProductDialog open={addOpen} onClose={() => setAddOpen(false)} />

            <Dialog open={adjusting !== null} onClose={closeDialog} fullWidth maxWidth="xs">
                <DialogTitle>{t('products_page.adjust_stock_title', { name: adjusting?.name })}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        {error && <Alert severity="error">{error}</Alert>}
                        <TextField
                            select
                            label={t('fields.warehouse')}
                            value={warehouseId}
                            onChange={(e) => setWarehouseId(Number(e.target.value))}
                            fullWidth
                        >
                            {adjusting?.stocks.map((stock) => (
                                <MenuItem key={stock.warehouse_id} value={stock.warehouse_id}>
                                    {stock.warehouse_name} ({stock.quantity})
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            label={t('products_page.quantity_placeholder')}
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            helperText={t('products_page.quantity_hint')}
                            fullWidth
                        />
                        <TextField
                            label={t('fields.reason')}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            fullWidth
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDialog}>{t('actions.cancel')}</Button>
                    <Button
                        variant="contained"
                        onClick={submitAdjustment}
                        disabled={mutation.isPending || !quantity || !reason}
                    >
                        {t('actions.save')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
