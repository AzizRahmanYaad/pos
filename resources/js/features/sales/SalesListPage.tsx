import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Alert,
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
import { useNavigate } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import AssignmentReturnOutlinedIcon from '@mui/icons-material/AssignmentReturnOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { useTranslation } from 'react-i18next';
import { fetchSalesPage, refundSale, type SaleListItem } from '@/features/sales/api';
import { DualDateField } from '@/components/DualDateField';

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
    completed: 'success',
    partially_refunded: 'warning',
    refunded: 'error',
    cancelled: 'default',
};

export function SalesListPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [page, setPage] = useState(0);
    const [perPage, setPerPage] = useState(10);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    useEffect(() => {
        const handle = setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(0);
        }, 300);
        return () => clearTimeout(handle);
    }, [searchInput]);

    const { data, isLoading, isError, isFetching } = useQuery({
        queryKey: ['sales-page', page, perPage, search, status, fromDate, toDate],
        queryFn: () =>
            fetchSalesPage({
                page: page + 1,
                perPage,
                search: search || undefined,
                status: status || undefined,
                from: fromDate || undefined,
                to: toDate || undefined,
            }),
        placeholderData: keepPreviousData,
    });

    const [returning, setReturning] = useState<SaleListItem | null>(null);
    const [returnError, setReturnError] = useState<string | null>(null);

    const returnMutation = useMutation({
        mutationFn: (sale: SaleListItem) => refundSale(sale.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales-page'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['products-page'] });
            setReturning(null);
            setReturnError(null);
        },
        onError: () => setReturnError(t('sales_page.return_failed')),
    });

    const money = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 3 }}>
                <Box>
                    <Typography variant="h4" fontWeight={800}>
                        {t('nav.sales')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {t('sales_page.subtitle')}
                    </Typography>
                </Box>
            </Box>

            {isError && <Alert severity="error">{t('common.loading')}</Alert>}

            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                <Stack spacing={2} sx={{ p: 2 }}>
                    <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
                        <TextField
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder={t('sales_page.search_placeholder')}
                            size="small"
                            fullWidth
                            sx={{ maxWidth: 320 }}
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
                                icon={<ReceiptLongOutlinedIcon />}
                                label={t('sales_page.count', { count: data.meta.total })}
                            />
                        )}
                    </Stack>
                    <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
                        <DualDateField label={t('sales_page.from_date')} value={fromDate} onChange={setFromDate} />
                        <DualDateField label={t('sales_page.to_date')} value={toDate} onChange={setToDate} />
                        <TextField
                            select
                            label={t('fields.status')}
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            size="small"
                            sx={{ minWidth: 180 }}
                        >
                            <MenuItem value="">{t('common.all')}</MenuItem>
                            <MenuItem value="completed">{t('status.completed')}</MenuItem>
                            <MenuItem value="partially_refunded">{t('status.partially_refunded')}</MenuItem>
                            <MenuItem value="refunded">{t('status.refunded')}</MenuItem>
                        </TextField>
                        {(fromDate || toDate || status) && (
                            <Button
                                size="small"
                                onClick={() => {
                                    setFromDate('');
                                    setToDate('');
                                    setStatus('');
                                }}
                            >
                                {t('sales_page.clear_filters')}
                            </Button>
                        )}
                    </Stack>
                </Stack>

                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                                <TableCell>#</TableCell>
                                <TableCell>{t('nav.customers')}</TableCell>
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
                            {data?.data.map((sale) => (
                                <TableRow
                                    key={sale.id}
                                    hover
                                    sx={{ cursor: 'pointer' }}
                                    onClick={() => navigate(`/sales/${sale.id}`)}
                                >
                                    <TableCell sx={{ fontWeight: 600 }}>{sale.invoice_number}</TableCell>
                                    <TableCell>{sale.customer_name}</TableCell>
                                    <TableCell>{sale.sale_date?.slice(0, 10)}</TableCell>
                                    <TableCell>
                                        <Chip
                                            size="small"
                                            color={STATUS_COLOR[sale.status] ?? 'default'}
                                            variant="filled"
                                            label={t(`status.${sale.status}`)}
                                        />
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                                        {money(sale.grand_total)}
                                    </TableCell>
                                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                                        <Tooltip title={t('sales_page.view')}>
                                            <IconButton size="small" color="primary" onClick={() => navigate(`/sales/${sale.id}`)}>
                                                <VisibilityOutlinedIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        {(sale.status === 'completed' || sale.status === 'partially_refunded') && (
                                            <Tooltip title={t('sales_page.return')}>
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={() => {
                                                        setReturnError(null);
                                                        setReturning(sale);
                                                    }}
                                                >
                                                    <AssignmentReturnOutlinedIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {data && data.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6}>
                                        <Box sx={{ py: 6, textAlign: 'center' }}>
                                            <ReceiptLongOutlinedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                                            <Typography color="text.secondary">{t('sales_page.no_sales')}</Typography>
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

            <Dialog open={returning !== null} onClose={() => setReturning(null)} maxWidth="xs" fullWidth>
                <DialogTitle>{t('sales_page.return_sale')}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        {returnError && <Alert severity="error">{returnError}</Alert>}
                        <Typography>
                            {t('sales_page.return_whole_confirm', { invoice: returning?.invoice_number })}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {t('sales_page.return_partial_hint')}
                        </Typography>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setReturning(null)}>{t('actions.cancel')}</Button>
                    <Button
                        variant="contained"
                        color="error"
                        disabled={returnMutation.isPending}
                        onClick={() => returning && returnMutation.mutate(returning)}
                    >
                        {t('sales_page.return')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
