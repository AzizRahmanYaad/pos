import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Alert,
    Avatar,
    Box,
    Button,
    Chip,
    Divider,
    IconButton,
    InputAdornment,
    MenuItem,
    Paper,
    Stack,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import SearchIcon from '@mui/icons-material/Search';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import RemoveShoppingCartOutlinedIcon from '@mui/icons-material/RemoveShoppingCartOutlined';
import PercentIcon from '@mui/icons-material/Percent';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import { useTranslation } from 'react-i18next';
import { fetchProducts, type ProductListItem } from '@/features/products/api';
import { fetchCustomers } from '@/features/customers/api';
import { fetchWarehouses } from '@/features/warehouses/api';
import { fetchCashAccounts } from '@/features/cash-accounts/api';
import { createSale, type SalePaymentPayload, type SaleReceipt } from '@/features/pos/api';
import { ReceiptView } from '@/features/pos/ReceiptView';
import { LoadingButton } from '@/components/LoadingButton';

interface CartLine {
    product: ProductListItem;
    quantity: number;
    // The cashier can lower the price when a customer bargains.
    unitPrice: number;
}

type EntryMode = 'search' | 'barcode';
type DiscountMode = 'amount' | 'percent';

const CARD_COLORS = ['#1e6f5c', '#2b8a72', '#b8901f', '#3b7ea1', '#7d5ba6', '#a15b3b'];

export function PosPage() {
    const { t } = useTranslation();
    const theme = useTheme();
    const queryClient = useQueryClient();

    const { data: products } = useQuery({ queryKey: ['products'], queryFn: fetchProducts });
    const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: fetchCustomers });
    const { data: warehouses } = useQuery({ queryKey: ['warehouses'], queryFn: fetchWarehouses });
    const { data: cashAccounts } = useQuery({ queryKey: ['cash-accounts'], queryFn: fetchCashAccounts });

    const [mode, setMode] = useState<EntryMode>('search');
    const [search, setSearch] = useState('');
    const [barcode, setBarcode] = useState('');
    const [scanError, setScanError] = useState<string | null>(null);
    const barcodeRef = useRef<HTMLInputElement | null>(null);

    const [cart, setCart] = useState<CartLine[]>([]);
    const [customerId, setCustomerId] = useState<number | ''>('');
    const [warehouseId, setWarehouseId] = useState<number | ''>('');
    const [discountMode, setDiscountMode] = useState<DiscountMode>('amount');
    const [discountInput, setDiscountInput] = useState('');
    const [tenders, setTenders] = useState<SalePaymentPayload[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [receipt, setReceipt] = useState<SaleReceipt | null>(null);

    useEffect(() => {
        if (warehouses && warehouses.length > 0 && warehouseId === '') {
            setWarehouseId(warehouses[0].id);
        }
    }, [warehouses, warehouseId]);

    useEffect(() => {
        if (mode === 'barcode') barcodeRef.current?.focus();
    }, [mode]);

    const filteredProducts = useMemo(() => {
        if (!products) return [];
        const term = search.trim().toLowerCase();
        if (!term) return products;
        return products.filter(
            (p) =>
                p.name.toLowerCase().includes(term) ||
                p.sku.toLowerCase().includes(term) ||
                p.barcode === term,
        );
    }, [products, search]);

    const addToCart = (product: ProductListItem) => {
        setCart((prev) => {
            const existing = prev.find((line) => line.product.id === product.id);
            if (existing) {
                return prev.map((line) =>
                    line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line,
                );
            }
            return [...prev, { product, quantity: 1, unitPrice: product.sale_price }];
        });
    };

    const scanBarcode = () => {
        const code = barcode.trim();
        if (!code) return;
        const product =
            products?.find((p) => p.barcode === code) ??
            products?.find((p) => p.sku.toLowerCase() === code.toLowerCase());

        if (!product) {
            setScanError(t('pos_page.barcode_not_found', { code }));
        } else if (product.track_inventory && product.total_stock <= 0) {
            setScanError(t('pos_page.out_of_stock', { name: product.name }));
        } else {
            addToCart(product);
            setScanError(null);
        }
        setBarcode('');
        barcodeRef.current?.focus();
    };

    const updateLine = (productId: number, patch: Partial<Pick<CartLine, 'quantity' | 'unitPrice'>>) => {
        setCart((prev) =>
            prev.map((line) => (line.product.id === productId ? { ...line, ...patch } : line)),
        );
    };

    const stepQuantity = (productId: number, delta: number) => {
        setCart((prev) =>
            prev
                .map((line) =>
                    line.product.id === productId
                        ? { ...line, quantity: Math.max(0, line.quantity + delta) }
                        : line,
                )
                .filter((line) => line.quantity > 0),
        );
    };

    const removeLine = (productId: number) => {
        setCart((prev) => prev.filter((line) => line.product.id !== productId));
    };

    const subtotal = round2(cart.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));

    const discountValue = (() => {
        const raw = Number(discountInput) || 0;
        if (raw <= 0) return 0;
        const amount = discountMode === 'percent' ? (subtotal * Math.min(raw, 100)) / 100 : raw;
        return round2(Math.min(amount, subtotal));
    })();

    const grandTotal = round2(subtotal - discountValue);
    const totalTendered = round2(tenders.reduce((sum, tender) => sum + (tender.amount || 0), 0));
    const remaining = round2(grandTotal - totalTendered);
    const changeDue = remaining < 0 ? round2(-remaining) : 0;

    const addTender = () => {
        const account = cashAccounts?.[0];
        if (!account) return;
        setTenders((prev) => [
            ...prev,
            { cash_account_id: account.id, method: 'cash', amount: round2(Math.max(remaining, 0)) },
        ]);
    };

    const updateTender = (index: number, patch: Partial<SalePaymentPayload>) => {
        setTenders((prev) => prev.map((tender, i) => (i === index ? { ...tender, ...patch } : tender)));
    };

    const removeTender = (index: number) => setTenders((prev) => prev.filter((_, i) => i !== index));

    const clearSale = () => {
        setCart([]);
        setTenders([]);
        setCustomerId('');
        setDiscountInput('');
        setError(null);
        setScanError(null);
    };

    const mutation = useMutation({
        mutationFn: createSale,
        onSuccess: (sale) => {
            setReceipt(sale);
            clearSale();
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['cash-accounts'] });
        },
        onError: () => setError(t('pos_page.checkout_failed')),
    });

    const checkout = () => {
        if (!warehouseId || cart.length === 0) return;

        // Anything tendered above the total is change handed back to the
        // customer, so cap the recorded payments at the grand total.
        let overage = changeDue;
        const payments = [...tenders]
            .reverse()
            .map((tender) => {
                const cut = Math.min(tender.amount, overage);
                overage = round2(overage - cut);
                return { ...tender, amount: round2(tender.amount - cut) };
            })
            .reverse()
            .filter((tender) => tender.amount > 0);

        mutation.mutate({
            customer_id: customerId || null,
            warehouse_id: warehouseId,
            discount: discountValue || undefined,
            items: cart.map((line) => ({
                product_id: line.product.id,
                quantity: line.quantity,
                unit_id: line.product.unit_id,
                unit_price: line.unitPrice,
            })),
            payments,
        });
    };

    if (receipt) {
        return (
            <Box>
                <Alert severity="success" sx={{ mb: 2 }}>
                    {t('pos_page.sale_completed', { invoice: receipt.invoice_number })}
                </Alert>
                <ReceiptView sale={receipt} />
                <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 2 }}>
                    <Button variant="contained" onClick={() => window.print()}>
                        {t('pos_page.print_receipt')}
                    </Button>
                    <Button onClick={() => setReceipt(null)}>{t('pos_page.new_sale')}</Button>
                </Stack>
            </Box>
        );
    }

    const walkInUnderpaid = customerId === '' && remaining > 0;

    return (
        <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', md: 'row' } }}>
            {/* ---- Product picker ---- */}
            <Box sx={{ flex: '1 1 58%', minWidth: 0 }}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 2 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center">
                        <ToggleButtonGroup
                            exclusive
                            size="small"
                            value={mode}
                            onChange={(_, value) => value && setMode(value)}
                            color="primary"
                        >
                            <ToggleButton value="search" sx={{ px: 2, gap: 0.75 }}>
                                <SearchIcon fontSize="small" /> {t('pos_page.mode_search')}
                            </ToggleButton>
                            <ToggleButton value="barcode" sx={{ px: 2, gap: 0.75 }}>
                                <QrCodeScannerIcon fontSize="small" /> {t('pos_page.mode_barcode')}
                            </ToggleButton>
                        </ToggleButtonGroup>

                        {mode === 'search' ? (
                            <TextField
                                fullWidth
                                size="small"
                                placeholder={t('pos_page.search_placeholder')}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                autoFocus
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon fontSize="small" />
                                        </InputAdornment>
                                    ),
                                }}
                            />
                        ) : (
                            <TextField
                                fullWidth
                                size="small"
                                inputRef={barcodeRef}
                                placeholder={t('pos_page.scan_placeholder')}
                                value={barcode}
                                onChange={(e) => setBarcode(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        scanBarcode();
                                    }
                                }}
                                autoFocus
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <QrCodeScannerIcon fontSize="small" color="primary" />
                                        </InputAdornment>
                                    ),
                                }}
                            />
                        )}
                    </Stack>
                    {mode === 'barcode' && (
                        <Typography
                            variant="caption"
                            color={scanError ? 'error' : 'text.secondary'}
                            sx={{ display: 'block', mt: 1 }}
                        >
                            {scanError ?? t('pos_page.scan_hint')}
                        </Typography>
                    )}
                </Paper>

                <Box
                    sx={{
                        display: 'grid',
                        gap: 1.5,
                        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                        maxHeight: 'calc(100vh - 240px)',
                        overflowY: 'auto',
                        pr: 0.5,
                    }}
                >
                    {filteredProducts.map((product, index) => {
                        const color = CARD_COLORS[index % CARD_COLORS.length];
                        const out = product.track_inventory && product.total_stock <= 0;
                        return (
                            <Paper
                                key={product.id}
                                variant="outlined"
                                onClick={() => !out && addToCart(product)}
                                sx={{
                                    p: 1.5,
                                    borderRadius: 2.5,
                                    cursor: out ? 'not-allowed' : 'pointer',
                                    opacity: out ? 0.5 : 1,
                                    transition: 'transform 120ms ease, box-shadow 120ms ease',
                                    '&:hover': out
                                        ? {}
                                        : {
                                              transform: 'translateY(-2px)',
                                              boxShadow: `0 8px 18px -8px ${alpha(color, 0.5)}`,
                                              borderColor: color,
                                          },
                                }}
                            >
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                                    <Avatar
                                        variant="rounded"
                                        sx={{
                                            width: 34,
                                            height: 34,
                                            fontSize: 14,
                                            fontWeight: 700,
                                            bgcolor: alpha(color, 0.15),
                                            color,
                                        }}
                                    >
                                        {product.name.slice(0, 2).toUpperCase()}
                                    </Avatar>
                                    <Typography variant="subtitle2" sx={{ lineHeight: 1.2 }} noWrap>
                                        {product.name}
                                    </Typography>
                                </Stack>
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Typography variant="subtitle2" fontWeight={800} color="primary.main">
                                        {product.sale_price.toFixed(2)}
                                    </Typography>
                                    {product.track_inventory && (
                                        <Chip
                                            size="small"
                                            variant="outlined"
                                            color={out ? 'error' : 'default'}
                                            label={`${product.total_stock} ${product.unit_short_name}`}
                                            sx={{ height: 20, fontSize: 11 }}
                                        />
                                    )}
                                </Stack>
                            </Paper>
                        );
                    })}
                </Box>
            </Box>

            {/* ---- Cart / checkout ---- */}
            <Box sx={{ flex: '1 1 42%', minWidth: 0 }}>
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <ShoppingCartOutlinedIcon color="primary" />
                            <Typography variant="h6" fontWeight={700}>
                                {t('pos_page.current_sale')}
                            </Typography>
                        </Stack>
                        {cart.length > 0 && (
                            <Tooltip title={t('pos_page.clear_sale')}>
                                <IconButton size="small" color="error" onClick={clearSale}>
                                    <RemoveShoppingCartOutlinedIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Stack>

                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                        <TextField
                            select
                            size="small"
                            label={t('nav.customers')}
                            value={customerId}
                            onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : '')}
                            sx={{ flex: 1 }}
                            SelectProps={{ displayEmpty: true }}
                            InputLabelProps={{ shrink: true }}
                        >
                            <MenuItem value="">{t('common.walk_in')}</MenuItem>
                            {customers?.map((c) => (
                                <MenuItem key={c.id} value={c.id}>
                                    {c.name}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            select
                            size="small"
                            label={t('fields.warehouse')}
                            value={warehouseId}
                            onChange={(e) => setWarehouseId(Number(e.target.value))}
                            sx={{ flex: 1 }}
                        >
                            {warehouses?.map((w) => (
                                <MenuItem key={w.id} value={w.id}>
                                    {w.name}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Stack>

                    {cart.length === 0 ? (
                        <Box sx={{ py: 5, textAlign: 'center' }}>
                            <ShoppingCartOutlinedIcon sx={{ fontSize: 42, color: 'text.disabled' }} />
                            <Typography color="text.secondary" sx={{ mt: 1 }}>
                                {t('pos_page.empty_cart')}
                            </Typography>
                        </Box>
                    ) : (
                        <Stack spacing={1} sx={{ maxHeight: 300, overflowY: 'auto', pr: 0.5 }}>
                            {cart.map((line) => {
                                const bargained = line.unitPrice !== line.product.sale_price;
                                return (
                                    <Paper
                                        key={line.product.id}
                                        variant="outlined"
                                        sx={{ p: 1.25, borderRadius: 2 }}
                                    >
                                        <Stack
                                            direction="row"
                                            alignItems="center"
                                            justifyContent="space-between"
                                            sx={{ mb: 0.75 }}
                                        >
                                            <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: 1 }}>
                                                {line.product.name}
                                            </Typography>
                                            <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => removeLine(line.product.id)}
                                            >
                                                <DeleteOutlineIcon fontSize="small" />
                                            </IconButton>
                                        </Stack>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <Stack direction="row" alignItems="center">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => stepQuantity(line.product.id, -1)}
                                                >
                                                    <RemoveIcon fontSize="small" />
                                                </IconButton>
                                                <TextField
                                                    type="number"
                                                    size="small"
                                                    value={line.quantity}
                                                    onChange={(e) =>
                                                        updateLine(line.product.id, {
                                                            quantity: Math.max(0, Number(e.target.value)),
                                                        })
                                                    }
                                                    inputProps={{ style: { textAlign: 'center', padding: '4px' } }}
                                                    sx={{ width: 54 }}
                                                />
                                                <IconButton
                                                    size="small"
                                                    onClick={() => stepQuantity(line.product.id, 1)}
                                                >
                                                    <AddIcon fontSize="small" />
                                                </IconButton>
                                            </Stack>
                                            <TextField
                                                type="number"
                                                size="small"
                                                label={t('fields.price')}
                                                value={line.unitPrice}
                                                onChange={(e) =>
                                                    updateLine(line.product.id, {
                                                        unitPrice: Math.max(0, Number(e.target.value)),
                                                    })
                                                }
                                                sx={{ width: 92 }}
                                                color={bargained ? 'warning' : undefined}
                                                focused={bargained || undefined}
                                            />
                                            <Box sx={{ flex: 1 }} />
                                            <Typography variant="subtitle2" fontWeight={700}>
                                                {round2(line.quantity * line.unitPrice).toFixed(2)}
                                            </Typography>
                                        </Stack>
                                        {bargained && (
                                            <Typography variant="caption" color="warning.main">
                                                {t('pos_page.price_adjusted', {
                                                    original: line.product.sale_price.toFixed(2),
                                                })}
                                            </Typography>
                                        )}
                                    </Paper>
                                );
                            })}
                        </Stack>
                    )}

                    <Divider sx={{ my: 2 }} />

                    {/* Discount */}
                    <Stack direction="row" spacing={1} alignItems="center">
                        <PercentIcon fontSize="small" color="action" />
                        <Typography variant="body2" sx={{ flex: 1 }}>
                            {t('pos_page.discount')}
                        </Typography>
                        <ToggleButtonGroup
                            exclusive
                            size="small"
                            value={discountMode}
                            onChange={(_, value) => value && setDiscountMode(value)}
                        >
                            <ToggleButton value="amount" sx={{ px: 1.25, py: 0.25 }}>
                                #
                            </ToggleButton>
                            <ToggleButton value="percent" sx={{ px: 1.25, py: 0.25 }}>
                                %
                            </ToggleButton>
                        </ToggleButtonGroup>
                        <TextField
                            type="number"
                            size="small"
                            value={discountInput}
                            onChange={(e) => setDiscountInput(e.target.value)}
                            sx={{ width: 90 }}
                        />
                    </Stack>

                    {/* Totals */}
                    <Box
                        sx={{
                            mt: 2,
                            p: 1.5,
                            borderRadius: 2,
                            bgcolor: alpha(theme.palette.primary.main, 0.06),
                        }}
                    >
                        <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2" color="text.secondary">
                                {t('fields.subtotal')}
                            </Typography>
                            <Typography variant="body2">{subtotal.toFixed(2)}</Typography>
                        </Stack>
                        {discountValue > 0 && (
                            <Stack direction="row" justifyContent="space-between">
                                <Typography variant="body2" color="text.secondary">
                                    {t('pos_page.discount')}
                                </Typography>
                                <Typography variant="body2" color="error.main">
                                    −{discountValue.toFixed(2)}
                                </Typography>
                            </Stack>
                        )}
                        <Divider sx={{ my: 1 }} />
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="subtitle1" fontWeight={700}>
                                {t('fields.grand_total')}
                            </Typography>
                            <Typography variant="h5" fontWeight={800} color="primary.main">
                                {grandTotal.toFixed(2)}
                            </Typography>
                        </Stack>
                    </Box>

                    {/* Payment */}
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2, mb: 1 }}>
                        <PaymentsOutlinedIcon fontSize="small" color="action" />
                        <Typography variant="subtitle2" sx={{ flex: 1 }}>
                            {t('pos_page.payment')}
                        </Typography>
                        <Button size="small" onClick={addTender} disabled={!cashAccounts?.length}>
                            {t('pos_page.add_tender')}
                        </Button>
                    </Stack>
                    {tenders.map((tender, index) => (
                        <Stack direction="row" spacing={1} alignItems="center" key={index} sx={{ mt: 1 }}>
                            <TextField
                                select
                                size="small"
                                value={tender.cash_account_id}
                                onChange={(e) => updateTender(index, { cash_account_id: Number(e.target.value) })}
                                sx={{ flex: 1 }}
                            >
                                {cashAccounts?.map((account) => (
                                    <MenuItem key={account.id} value={account.id}>
                                        {account.name}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                type="number"
                                size="small"
                                value={tender.amount}
                                onChange={(e) => updateTender(index, { amount: Number(e.target.value) })}
                                sx={{ width: 100 }}
                            />
                            <IconButton size="small" onClick={() => removeTender(index)}>
                                <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                        </Stack>
                    ))}

                    <Typography
                        variant="body2"
                        sx={{ mt: 1.5 }}
                        color={remaining > 0 ? 'error' : changeDue > 0 ? 'warning.main' : 'success.main'}
                        fontWeight={600}
                    >
                        {remaining > 0
                            ? t('pos_page.remaining', { amount: remaining.toFixed(2) })
                            : changeDue > 0
                              ? t('pos_page.change_due', { amount: changeDue.toFixed(2) })
                              : t('pos_page.fully_paid')}
                    </Typography>
                    {walkInUnderpaid && (
                        <Typography variant="caption" color="text.secondary">
                            {t('pos_page.walk_in_must_pay')}
                        </Typography>
                    )}

                    <LoadingButton
                        fullWidth
                        variant="contained"
                        size="large"
                        sx={{
                            mt: 2,
                            py: 1.4,
                            borderRadius: 2.5,
                            fontWeight: 700,
                            fontSize: '1rem',
                            textTransform: 'none',
                            background: `linear-gradient(135deg, ${theme.palette.primary.main}, #2b8a72)`,
                        }}
                        loading={mutation.isPending}
                        disabled={cart.length === 0 || walkInUnderpaid}
                        onClick={checkout}
                    >
                        {t('pos_page.complete_sale')} · {grandTotal.toFixed(2)}
                    </LoadingButton>
                </Paper>
            </Box>
        </Box>
    );
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}
