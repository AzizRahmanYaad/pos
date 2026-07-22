import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
    Box,
    Chip,
    CircularProgress,
    Grid,
    InputAdornment,
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
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import HighlightOffOutlinedIcon from '@mui/icons-material/HighlightOffOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import { useTranslation } from 'react-i18next';
import { fetchStockList, fetchStockSummary, type StockListItem } from '@/features/inventory/api';
import { fetchWarehouses } from '@/features/warehouses/api';
import { fetchBusinessSettings } from '@/features/settings/api';

type StatusFilter = 'all' | 'low' | 'out' | 'reorder';

const STATUS_COLOR: Record<StockListItem['status'], 'success' | 'warning' | 'error'> = {
    ok: 'success',
    low: 'warning',
    out: 'error',
};

function StatTile({
    icon,
    label,
    value,
    color,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    color: string;
}) {
    return (
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
                        bgcolor: alpha(color, 0.12),
                        color,
                    }}
                >
                    {icon}
                </Box>
                <Box>
                    <Typography variant="h5" fontWeight={800}>
                        {value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {label}
                    </Typography>
                </Box>
            </Stack>
        </Paper>
    );
}

export function StocksPage() {
    const { t } = useTranslation();
    const theme = useTheme();

    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [warehouseId, setWarehouseId] = useState<number | ''>('');
    const [status, setStatus] = useState<StatusFilter>('all');

    useEffect(() => {
        const handle = setTimeout(() => setSearch(searchInput.trim()), 300);
        return () => clearTimeout(handle);
    }, [searchInput]);

    const filters = {
        search: search || undefined,
        warehouseId: warehouseId || undefined,
        status: status === 'all' ? undefined : status,
    };

    const { data: stocks, isLoading, isFetching } = useQuery({
        queryKey: ['stock-list', filters],
        queryFn: () => fetchStockList(filters),
        placeholderData: keepPreviousData,
    });
    const { data: summary } = useQuery({ queryKey: ['stock-summary'], queryFn: fetchStockSummary });
    const { data: warehouses } = useQuery({ queryKey: ['warehouses'], queryFn: fetchWarehouses });
    const { data: settings } = useQuery({ queryKey: ['business-settings'], queryFn: fetchBusinessSettings });

    const sym = settings?.currency_symbol ?? '';
    const money = (v: number) =>
        `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${sym ? ` ${sym}` : ''}`;
    const qty = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));

    return (
        <Box>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" fontWeight={800}>
                    {t('stocks_page.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {t('stocks_page.subtitle')}
                </Typography>
            </Box>

            <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <StatTile
                        icon={<Inventory2OutlinedIcon />}
                        label={t('stocks_page.tracked_products')}
                        value={String(summary?.tracked_products ?? 0)}
                        color={theme.palette.primary.main}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatTile
                        icon={<ReportProblemOutlinedIcon />}
                        label={t('stocks_page.low_stock')}
                        value={String(summary?.low_stock_count ?? 0)}
                        color={theme.palette.warning.main}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatTile
                        icon={<HighlightOffOutlinedIcon />}
                        label={t('stocks_page.out_of_stock')}
                        value={String(summary?.out_of_stock_count ?? 0)}
                        color={theme.palette.error.main}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatTile
                        icon={<PaymentsOutlinedIcon />}
                        label={t('stocks_page.stock_value')}
                        value={money(summary?.total_stock_value ?? 0)}
                        color={theme.palette.success.main}
                    />
                </Grid>
            </Grid>

            <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1.5}
                    alignItems={{ md: 'center' }}
                    justifyContent="space-between"
                    flexWrap="wrap"
                    useFlexGap
                    sx={{ p: 2 }}
                >
                    <TextField
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder={t('stocks_page.search_placeholder')}
                        size="small"
                        sx={{ minWidth: 240, flex: 1, maxWidth: 380 }}
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
                    <TextField
                        select
                        size="small"
                        label={t('fields.warehouse')}
                        value={warehouseId}
                        onChange={(e) => setWarehouseId(e.target.value === '' ? '' : Number(e.target.value))}
                        sx={{ minWidth: 180 }}
                    >
                        <MenuItem value="">{t('stocks_page.all_warehouses')}</MenuItem>
                        {warehouses?.map((w) => (
                            <MenuItem key={w.id} value={w.id}>
                                {w.name}
                            </MenuItem>
                        ))}
                    </TextField>
                    <ToggleButtonGroup
                        size="small"
                        value={status}
                        exclusive
                        onChange={(_, next) => next && setStatus(next)}
                    >
                        <ToggleButton value="all">{t('stocks_page.filter_all')}</ToggleButton>
                        <ToggleButton value="low">{t('stocks_page.filter_low')}</ToggleButton>
                        <ToggleButton value="out">{t('stocks_page.filter_out')}</ToggleButton>
                    </ToggleButtonGroup>
                </Stack>

                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                                <TableCell>{t('fields.product')}</TableCell>
                                <TableCell>{t('fields.category')}</TableCell>
                                <TableCell>{t('stocks_page.by_warehouse')}</TableCell>
                                <TableCell align="right">{t('stocks_page.reorder_level')}</TableCell>
                                <TableCell align="right">{t('stocks_page.available_stock')}</TableCell>
                                <TableCell>{t('fields.status')}</TableCell>
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
                            {stocks?.map((row) => (
                                <TableRow key={row.id} hover>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={600}>
                                            {row.name}
                                        </Typography>
                                        {row.sku && (
                                            <Typography variant="caption" color="text.secondary">
                                                {row.sku}
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>{row.category_name ?? '—'}</TableCell>
                                    <TableCell>
                                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                            {row.warehouses.length > 0 ? (
                                                row.warehouses.map((wh) => (
                                                    <Chip
                                                        key={wh.warehouse_id}
                                                        size="small"
                                                        variant="outlined"
                                                        label={`${wh.warehouse_name ?? '—'}: ${qty(wh.quantity)}${row.unit_short_name ? ` ${row.unit_short_name}` : ''}`}
                                                    />
                                                ))
                                            ) : (
                                                <Typography variant="caption" color="text.secondary">
                                                    —
                                                </Typography>
                                            )}
                                        </Stack>
                                    </TableCell>
                                    <TableCell align="right">
                                        {qty(row.reorder_level)}
                                        {row.unit_short_name ? ` ${row.unit_short_name}` : ''}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                                        {qty(row.total_stock)}
                                        {row.unit_short_name ? ` ${row.unit_short_name}` : ''}
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            size="small"
                                            color={STATUS_COLOR[row.status]}
                                            variant={row.status === 'ok' ? 'outlined' : 'filled'}
                                            label={t(`stocks_page.status_${row.status}`)}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                            {stocks && stocks.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6}>
                                        <Box sx={{ py: 6, textAlign: 'center' }}>
                                            <WarehouseOutlinedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                                            <Typography color="text.secondary">{t('stocks_page.no_stock')}</Typography>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
}
