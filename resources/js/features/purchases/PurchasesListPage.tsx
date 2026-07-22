import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    IconButton,
    InputAdornment,
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
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import { useTranslation } from 'react-i18next';
import { fetchPurchasesPage, receivePurchase, cancelPurchase } from '@/features/purchases/api';

const STATUS_COLOR: Record<string, 'default' | 'success' | 'error'> = {
    draft: 'default',
    received: 'success',
    cancelled: 'error',
};

export function PurchasesListPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [page, setPage] = useState(0);
    const [perPage, setPerPage] = useState(10);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');

    useEffect(() => {
        const handle = setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(0);
        }, 300);
        return () => clearTimeout(handle);
    }, [searchInput]);

    const { data, isLoading, isError, isFetching } = useQuery({
        queryKey: ['purchases-page', page, perPage, search],
        queryFn: () => fetchPurchasesPage({ page: page + 1, perPage, search: search || undefined }),
        placeholderData: keepPreviousData,
    });

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['purchases-page'] });
        queryClient.invalidateQueries({ queryKey: ['products'] });
        queryClient.invalidateQueries({ queryKey: ['products-page'] });
    };
    const receiveMutation = useMutation({ mutationFn: receivePurchase, onSuccess: invalidate });
    const cancelMutation = useMutation({ mutationFn: cancelPurchase, onSuccess: invalidate });

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
                    <Typography variant="h4" fontWeight={800}>
                        {t('nav.purchases')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {t('purchases_page.subtitle')}
                    </Typography>
                </Box>
                <Button variant="contained" size="large" component={RouterLink} to="/purchases/new">
                    {t('purchases_page.new_purchase')}
                </Button>
            </Box>

            {isError && <Alert severity="error">{t('common.loading')}</Alert>}

            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ p: 2 }}>
                    <TextField
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder={t('purchases_page.search_placeholder')}
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
                            icon={<ShoppingCartOutlinedIcon />}
                            label={t('purchases_page.count', { count: data.meta.total })}
                        />
                    )}
                </Stack>

                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                                <TableCell>#</TableCell>
                                <TableCell>{t('nav.suppliers')}</TableCell>
                                <TableCell>{t('fields.date')}</TableCell>
                                <TableCell>{t('fields.status')}</TableCell>
                                <TableCell align="right">{t('fields.grand_total')}</TableCell>
                                <TableCell align="right"> </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={6}>
                                        <Box sx={{ py: 4, textAlign: 'center' }}>
                                            <CircularProgress size={28} />
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            )}
                            {data?.data.map((purchase) => (
                                <TableRow
                                    key={purchase.id}
                                    hover
                                    sx={{ cursor: 'pointer' }}
                                    onClick={() => navigate(`/purchases/${purchase.id}`)}
                                >
                                    <TableCell sx={{ fontWeight: 600 }}>{purchase.purchase_number}</TableCell>
                                    <TableCell>{purchase.supplier_name}</TableCell>
                                    <TableCell>{purchase.purchase_date?.slice(0, 10)}</TableCell>
                                    <TableCell>
                                        <Chip
                                            size="small"
                                            color={STATUS_COLOR[purchase.status]}
                                            variant={purchase.status === 'draft' ? 'outlined' : 'filled'}
                                            label={t(`status.${purchase.status}`)}
                                        />
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                                        {purchase.grand_total.toFixed(2)}
                                    </TableCell>
                                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                                        <Tooltip title={t('purchases_page.view')}>
                                            <IconButton
                                                size="small"
                                                color="primary"
                                                onClick={() => navigate(`/purchases/${purchase.id}`)}
                                            >
                                                <VisibilityOutlinedIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        {purchase.status === 'draft' && (
                                            <>
                                                <Tooltip title={t('actions.receive')}>
                                                    <IconButton
                                                        size="small"
                                                        color="success"
                                                        disabled={receiveMutation.isPending}
                                                        onClick={() => receiveMutation.mutate(purchase.id)}
                                                    >
                                                        <CheckCircleOutlineIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title={t('actions.cancel')}>
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        disabled={cancelMutation.isPending}
                                                        onClick={() => cancelMutation.mutate(purchase.id)}
                                                    >
                                                        <CancelOutlinedIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {data && data.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6}>
                                        <Box sx={{ py: 6, textAlign: 'center' }}>
                                            <ShoppingCartOutlinedIcon
                                                sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }}
                                            />
                                            <Typography color="text.secondary">
                                                {t('purchases_page.no_purchases')}
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
        </Box>
    );
}
