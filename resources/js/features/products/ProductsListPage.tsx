import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Alert,
    Avatar,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    InputAdornment,
    MenuItem,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { isAxiosError } from 'axios';
import SearchIcon from '@mui/icons-material/Search';
import TuneIcon from '@mui/icons-material/Tune';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AutoModeOutlinedIcon from '@mui/icons-material/AutoModeOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import { useTranslation } from 'react-i18next';
import {
    fetchProductsPage,
    downloadProductListPdf,
    deleteProduct,
    type ProductListItem,
} from '@/features/products/api';
import { createStockAdjustment } from '@/features/inventory/api';
import { AddProductDialog } from '@/features/products/AddProductDialog';
import { EditProductDialog } from '@/features/products/EditProductDialog';
import { EditPricingDialog } from '@/features/products/EditPricingDialog';
import { Can } from '@/components/Can';
import { ReportActions } from '@/components/ReportActions';
import { fetchBusinessSettings } from '@/features/settings/api';

const AVATAR_COLORS = ['#1e6f5c', '#2b8a72', '#b8901f', '#3b7ea1', '#7d5ba6', '#a15b3b'];

function stockColor(product: ProductListItem): 'error' | 'warning' | 'success' {
    if (product.total_stock <= 0) return 'error';
    if (product.total_stock <= product.reorder_level) return 'warning';
    return 'success';
}

export function ProductsListPage() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    const [page, setPage] = useState(0);
    const [perPage, setPerPage] = useState(10);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');

    // Debounce typing so we don't hit the API on every keystroke.
    useEffect(() => {
        const handle = setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(0);
        }, 300);
        return () => clearTimeout(handle);
    }, [searchInput]);

    const { data, isLoading, isError, isFetching } = useQuery({
        queryKey: ['products-page', page, perPage, search],
        queryFn: () => fetchProductsPage({ page: page + 1, perPage, search: search || undefined }),
        placeholderData: keepPreviousData,
    });

    const { data: settings } = useQuery({ queryKey: ['business-settings'], queryFn: fetchBusinessSettings });
    const companyName = settings?.company_name ?? '';

    const [addOpen, setAddOpen] = useState(false);
    const [adjusting, setAdjusting] = useState<ProductListItem | null>(null);
    const [pricingProduct, setPricingProduct] = useState<ProductListItem | null>(null);
    const [editingProduct, setEditingProduct] = useState<ProductListItem | null>(null);
    const [deleting, setDeleting] = useState<ProductListItem | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [warehouseId, setWarehouseId] = useState<number | ''>('');
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [error, setError] = useState<string | null>(null);

    const deleteMutation = useMutation({
        mutationFn: (product: ProductListItem) => deleteProduct(product.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products-page'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            setDeleting(null);
            setDeleteError(null);
        },
        onError: (err) => {
            const message = isAxiosError(err) ? err.response?.data?.message : undefined;
            setDeleteError(message || t('products_page.delete_failed'));
        },
    });

    const mutation = useMutation({
        mutationFn: createStockAdjustment,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products-page'] });
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
            <Box
                sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 2,
                    mb: 3,
                }}
            >
                <Box>
                    <Typography variant="h4" fontWeight={700}>
                        {t('nav.products')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {t('products_page.subtitle')}
                    </Typography>
                </Box>
                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                    <ReportActions
                        download={() => downloadProductListPdf(search || undefined)}
                        message={t('products_page.wa_message', { company: companyName })}
                        size="medium"
                    />
                    <Can permission="products.manage">
                        <Button variant="contained" size="large" onClick={() => setAddOpen(true)}>
                            {t('products_page.new_product')}
                        </Button>
                    </Can>
                </Stack>
            </Box>

            {isError && <Alert severity="error">{t('common.loading')}</Alert>}

            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                <Stack
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ p: 2 }}
                >
                    <TextField
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder={t('products_page.search_placeholder')}
                        size="small"
                        fullWidth
                        sx={{ maxWidth: 380 }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" />
                                </InputAdornment>
                            ),
                            endAdornment: isFetching ? (
                                <InputAdornment position="end">
                                    <CircularProgress size={16} />
                                </InputAdornment>
                            ) : undefined,
                        }}
                    />
                    {data && (
                        <Chip
                            variant="outlined"
                            size="small"
                            icon={<Inventory2OutlinedIcon />}
                            label={t('products_page.count', { count: data.meta.total })}
                        />
                    )}
                </Stack>

                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                                <TableCell>{t('nav.products')}</TableCell>
                                <TableCell>{t('fields.category')}</TableCell>
                                <TableCell align="right">{t('fields.stock')}</TableCell>
                                <TableCell align="right">{t('fields.price')}</TableCell>
                                <TableCell>{t('fields.status')}</TableCell>
                                <Can permission="products.manage">
                                    <TableCell align="right"> </TableCell>
                                </Can>
                                <Can permission="inventory.manage">
                                    <TableCell align="right"> </TableCell>
                                </Can>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={7}>
                                        <Box sx={{ py: 4, textAlign: 'center' }}>
                                            <CircularProgress size={28} />
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            )}
                            {data?.data.map((product, index) => {
                                const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
                                return (
                                    <TableRow key={product.id} hover>
                                        <TableCell>
                                            <Stack direction="row" spacing={1.5} alignItems="center">
                                                <Avatar
                                                    variant="rounded"
                                                    sx={{
                                                        width: 38,
                                                        height: 38,
                                                        fontSize: 14,
                                                        fontWeight: 700,
                                                        bgcolor: alpha(color, 0.15),
                                                        color,
                                                    }}
                                                >
                                                    {product.name.slice(0, 2).toUpperCase()}
                                                </Avatar>
                                                <Box>
                                                    <Typography variant="body2" fontWeight={600}>
                                                        {product.name}
                                                    </Typography>
                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                        <Typography variant="caption" color="text.secondary">
                                                            {product.sku}
                                                        </Typography>
                                                        {product.barcode && (
                                                            <Tooltip title={product.barcode}>
                                                                <QrCode2Icon
                                                                    sx={{ fontSize: 14, color: 'text.disabled' }}
                                                                />
                                                            </Tooltip>
                                                        )}
                                                    </Stack>
                                                </Box>
                                            </Stack>
                                        </TableCell>
                                        <TableCell>
                                            {product.category_name ? (
                                                <Chip
                                                    size="small"
                                                    variant="outlined"
                                                    label={product.category_name}
                                                />
                                            ) : (
                                                <Typography variant="body2" color="text.disabled">
                                                    —
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell align="right">
                                            {product.track_inventory ? (
                                                <Chip
                                                    size="small"
                                                    color={stockColor(product)}
                                                    variant={
                                                        stockColor(product) === 'success'
                                                            ? 'outlined'
                                                            : 'filled'
                                                    }
                                                    label={`${product.total_stock} ${product.unit_short_name}`}
                                                />
                                            ) : (
                                                <Typography variant="caption" color="text.secondary">
                                                    {t(`products_page.type_${product.type}`, {
                                                        defaultValue: product.type,
                                                    })}
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell align="right">
                                            <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={0.5}>
                                                {product.pricing_mode === 'margin' && (
                                                    <Tooltip
                                                        title={t('products_page.auto_priced_tooltip', {
                                                            margin: product.margin_percent,
                                                        })}
                                                    >
                                                        <AutoModeOutlinedIcon fontSize="small" color="primary" />
                                                    </Tooltip>
                                                )}
                                                <Typography variant="body2" fontWeight={700} color="primary.main">
                                                    {product.sale_price.toFixed(2)}
                                                </Typography>
                                            </Stack>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                size="small"
                                                color={product.is_active ? 'success' : 'default'}
                                                variant="outlined"
                                                label={
                                                    product.is_active
                                                        ? t('status.active')
                                                        : t('status.inactive')
                                                }
                                            />
                                        </TableCell>
                                        <Can permission="products.manage">
                                            <TableCell align="right">
                                                <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                                    <Tooltip title={t('products_page.edit_product')}>
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => setEditingProduct(product)}
                                                        >
                                                            <EditOutlinedIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title={t('products_page.edit_pricing')}>
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => setPricingProduct(product)}
                                                        >
                                                            <SellOutlinedIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title={t('products_page.delete_product')}>
                                                        <IconButton
                                                            size="small"
                                                            color="error"
                                                            onClick={() => {
                                                                setDeleteError(null);
                                                                setDeleting(product);
                                                            }}
                                                        >
                                                            <DeleteOutlineIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Stack>
                                            </TableCell>
                                        </Can>
                                        <Can permission="inventory.manage">
                                            <TableCell align="right">
                                                <Tooltip title={t('actions.adjust')}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => openDialog(product)}
                                                    >
                                                        <TuneIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </Can>
                                    </TableRow>
                                );
                            })}
                            {data && data.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7}>
                                        <Box sx={{ py: 6, textAlign: 'center' }}>
                                            <Inventory2OutlinedIcon
                                                sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }}
                                            />
                                            <Typography color="text.secondary">
                                                {t('products_page.no_products')}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>

                <TablePagination
                    component="div"
                    count={data?.meta.total ?? 0}
                    page={page}
                    onPageChange={(_, newPage) => setPage(newPage)}
                    rowsPerPage={perPage}
                    onRowsPerPageChange={(e) => {
                        setPerPage(Number(e.target.value));
                        setPage(0);
                    }}
                    rowsPerPageOptions={[10, 20, 50]}
                />
            </Paper>

            <AddProductDialog open={addOpen} onClose={() => setAddOpen(false)} />

            <EditProductDialog product={editingProduct} onClose={() => setEditingProduct(null)} />

            <EditPricingDialog product={pricingProduct} onClose={() => setPricingProduct(null)} />

            <Dialog open={deleting !== null} onClose={() => setDeleting(null)} maxWidth="xs" fullWidth>
                <DialogTitle>{t('products_page.delete_product')}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        {deleteError && <Alert severity="error">{deleteError}</Alert>}
                        <Typography>
                            {t('products_page.delete_confirm', { name: deleting?.name })}
                        </Typography>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleting(null)}>{t('actions.cancel')}</Button>
                    <Button
                        variant="contained"
                        color="error"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleting && deleteMutation.mutate(deleting)}
                    >
                        {t('actions.delete')}
                    </Button>
                </DialogActions>
            </Dialog>

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
