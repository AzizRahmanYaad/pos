import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
    Alert,
    Avatar,
    Box,
    Button,
    Chip,
    CircularProgress,
    Grid,
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
import { alpha, useTheme } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import TrendingDownOutlinedIcon from '@mui/icons-material/TrendingDownOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { fetchSuppliersPage, fetchSupplierSummary, type SupplierListItem } from '@/features/suppliers/api';
import { PaymentDialog } from '@/features/payments/PaymentDialog';
import { AddPartyDialog } from '@/components/AddPartyDialog';
import { Can } from '@/components/Can';
import { fetchBusinessSettings } from '@/features/settings/api';

const AVATAR_COLORS = ['#1e6f5c', '#2b8a72', '#b8901f', '#3b7ea1', '#7d5ba6', '#a15b3b'];

function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();
}

export function SuppliersListPage() {
    const { t } = useTranslation();
    const theme = useTheme();
    const navigate = useNavigate();

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
        queryKey: ['suppliers-page', page, perPage, search],
        queryFn: () => fetchSuppliersPage({ page: page + 1, perPage, search: search || undefined }),
        placeholderData: keepPreviousData,
    });

    const { data: settings } = useQuery({ queryKey: ['business-settings'], queryFn: fetchBusinessSettings });
    const sym = settings?.currency_symbol ?? '';
    const money = (v: number) =>
        `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${sym ? ` ${sym}` : ''}`;

    const { data: summary } = useQuery({ queryKey: ['suppliers-summary'], queryFn: fetchSupplierSummary });

    const [addOpen, setAddOpen] = useState(false);
    const [paying, setPaying] = useState<SupplierListItem | null>(null);

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
                        {t('nav.suppliers')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {t('suppliers_page.subtitle')}
                    </Typography>
                </Box>
                <Can permission="purchases.manage">
                    <Button variant="contained" size="large" onClick={() => setAddOpen(true)}>
                        {t('parties.new_supplier')}
                    </Button>
                </Can>
            </Box>

            <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
                <Grid item xs={12} sm={6}>
                    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                            <Box
                                sx={{
                                    width: 42,
                                    height: 42,
                                    borderRadius: 2,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    bgcolor: alpha(theme.palette.error.main, 0.12),
                                    color: theme.palette.error.main,
                                }}
                            >
                                <TrendingDownOutlinedIcon />
                            </Box>
                            <Box>
                                <Typography variant="h5" fontWeight={800}>
                                    {money(summary?.payable ?? 0)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {t('suppliers_page.total_payable')}
                                </Typography>
                            </Box>
                        </Stack>
                    </Paper>
                </Grid>
                <Grid item xs={12} sm={6}>
                    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                            <Box
                                sx={{
                                    width: 42,
                                    height: 42,
                                    borderRadius: 2,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    bgcolor: alpha(theme.palette.success.main, 0.12),
                                    color: theme.palette.success.main,
                                }}
                            >
                                <TrendingUpOutlinedIcon />
                            </Box>
                            <Box>
                                <Typography variant="h5" fontWeight={800}>
                                    {money(summary?.advance ?? 0)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {t('suppliers_page.total_advance')}
                                </Typography>
                            </Box>
                        </Stack>
                    </Paper>
                </Grid>
            </Grid>

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
                        placeholder={t('suppliers_page.search_placeholder')}
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
                            icon={<LocalShippingOutlinedIcon />}
                            label={t('suppliers_page.count', { count: data.meta.total })}
                        />
                    )}
                </Stack>

                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                                <TableCell>{t('nav.suppliers')}</TableCell>
                                <TableCell>{t('fields.phone')}</TableCell>
                                <TableCell align="right">{t('fields.balance')}</TableCell>
                                <TableCell align="right"> </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={4}>
                                        <Box sx={{ py: 4, textAlign: 'center' }}>
                                            <CircularProgress size={28} />
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            )}
                            {data?.data.map((supplier, index) => {
                                const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
                                return (
                                    <TableRow key={supplier.id} hover>
                                        <TableCell>
                                            <Stack direction="row" spacing={1.5} alignItems="center">
                                                <Avatar
                                                    sx={{
                                                        width: 38,
                                                        height: 38,
                                                        fontSize: 14,
                                                        fontWeight: 700,
                                                        bgcolor: alpha(color, 0.15),
                                                        color,
                                                    }}
                                                >
                                                    {initials(supplier.name)}
                                                </Avatar>
                                                <Box>
                                                    <Typography variant="body2" fontWeight={600}>
                                                        {supplier.name}
                                                    </Typography>
                                                    {supplier.address && (
                                                        <Typography variant="caption" color="text.secondary">
                                                            {supplier.address}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </Stack>
                                        </TableCell>
                                        <TableCell>{supplier.phone ?? '—'}</TableCell>
                                        <TableCell align="right">
                                            {supplier.current_balance < 0 ? (
                                                <Chip
                                                    size="small"
                                                    color="error"
                                                    label={t('ledger.you_owe', {
                                                        amount: Math.abs(supplier.current_balance).toFixed(2),
                                                    })}
                                                />
                                            ) : supplier.current_balance > 0 ? (
                                                <Chip
                                                    size="small"
                                                    color="success"
                                                    label={t('ledger.supplier_advance', {
                                                        amount: supplier.current_balance.toFixed(2),
                                                    })}
                                                />
                                            ) : (
                                                <Chip
                                                    size="small"
                                                    variant="outlined"
                                                    label={t('ledger.settled')}
                                                />
                                            )}
                                        </TableCell>
                                        <TableCell align="right">
                                            <Tooltip title={t('ledger.view_ledger')}>
                                                <IconButton
                                                    size="small"
                                                    color="primary"
                                                    onClick={() => navigate(`/suppliers/${supplier.id}/ledger`)}
                                                >
                                                    <MenuBookOutlinedIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Can permission="payments.manage">
                                                <Tooltip title={t('actions.pay')}>
                                                    <IconButton
                                                        size="small"
                                                        color="success"
                                                        onClick={() => setPaying(supplier)}
                                                    >
                                                        <PaymentsOutlinedIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Can>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {data && data.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4}>
                                        <Box sx={{ py: 6, textAlign: 'center' }}>
                                            <LocalShippingOutlinedIcon
                                                sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }}
                                            />
                                            <Typography color="text.secondary">
                                                {t('suppliers_page.no_suppliers')}
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

            <AddPartyDialog kind="supplier" open={addOpen} onClose={() => setAddOpen(false)} />

            {paying && (
                <PaymentDialog
                    open
                    onClose={() => setPaying(null)}
                    partyType="supplier"
                    partyId={paying.id}
                    partyName={paying.name}
                    invalidateQueryKey="suppliers-page"
                />
            )}
        </Box>
    );
}
