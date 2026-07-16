import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Alert,
    Box,
    Button,
    Card,
    CardActionArea,
    CardContent,
    Grid,
    IconButton,
    MenuItem,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTranslation } from 'react-i18next';
import { fetchProducts, type ProductListItem } from '@/features/products/api';
import { fetchCustomers } from '@/features/customers/api';
import { fetchWarehouses } from '@/features/warehouses/api';
import { fetchCashAccounts } from '@/features/cash-accounts/api';
import { createSale, type SalePaymentPayload, type SaleReceipt } from '@/features/pos/api';
import { ReceiptView } from '@/features/pos/ReceiptView';

interface CartLine {
    product: ProductListItem;
    quantity: number;
}

export function PosPage() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    const { data: products } = useQuery({ queryKey: ['products'], queryFn: fetchProducts });
    const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: fetchCustomers });
    const { data: warehouses } = useQuery({ queryKey: ['warehouses'], queryFn: fetchWarehouses });
    const { data: cashAccounts } = useQuery({ queryKey: ['cash-accounts'], queryFn: fetchCashAccounts });

    const [search, setSearch] = useState('');
    const [cart, setCart] = useState<CartLine[]>([]);
    const [customerId, setCustomerId] = useState<number | ''>('');
    const [warehouseId, setWarehouseId] = useState<number | ''>('');
    const [tenders, setTenders] = useState<SalePaymentPayload[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [receipt, setReceipt] = useState<SaleReceipt | null>(null);

    useEffect(() => {
        if (warehouses && warehouses.length > 0 && warehouseId === '') {
            setWarehouseId(warehouses[0].id);
        }
    }, [warehouses, warehouseId]);

    const filteredProducts = useMemo(() => {
        if (!products) return [];
        const term = search.trim().toLowerCase();
        if (!term) return products;
        return products.filter(
            (p) => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term) || p.barcode === term,
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
            return [...prev, { product, quantity: 1 }];
        });
    };

    const updateQuantity = (productId: number, quantity: number) => {
        setCart((prev) => prev.map((line) => (line.product.id === productId ? { ...line, quantity } : line)));
    };

    const removeLine = (productId: number) => {
        setCart((prev) => prev.filter((line) => line.product.id !== productId));
    };

    const grandTotal = cart.reduce((sum, line) => sum + line.quantity * line.product.sale_price, 0);
    const totalTendered = tenders.reduce((sum, tender) => sum + (tender.amount || 0), 0);
    const remaining = round2(grandTotal - totalTendered);

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

    const mutation = useMutation({
        mutationFn: createSale,
        onSuccess: (sale) => {
            setReceipt(sale);
            setCart([]);
            setTenders([]);
            setCustomerId('');
            setError(null);
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
        onError: () => setError('Could not complete sale — check stock levels and tender amounts.'),
    });

    const checkout = () => {
        if (!warehouseId || cart.length === 0) return;
        mutation.mutate({
            customer_id: customerId || null,
            warehouse_id: warehouseId,
            items: cart.map((line) => ({
                product_id: line.product.id,
                quantity: line.quantity,
                unit_id: line.product.unit_id,
                unit_price: line.product.sale_price,
            })),
            payments: tenders,
        });
    };

    if (receipt) {
        return (
            <Box>
                <Alert severity="success" sx={{ mb: 2 }}>
                    Sale {receipt.invoice_number} completed.
                </Alert>
                <ReceiptView sale={receipt} />
                <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 2 }}>
                    <Button variant="contained" onClick={() => window.print()}>
                        Print receipt
                    </Button>
                    <Button onClick={() => setReceipt(null)}>New sale</Button>
                </Stack>
            </Box>
        );
    }

    return (
        <Grid container spacing={2}>
            <Grid item xs={12} md={7}>
                <TextField
                    fullWidth
                    label={t('actions.search')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    sx={{ mb: 2 }}
                    autoFocus
                />
                <Grid container spacing={1}>
                    {filteredProducts.map((product) => (
                        <Grid item xs={6} sm={4} key={product.id}>
                            <Card>
                                <CardActionArea onClick={() => addToCart(product)}>
                                    <CardContent>
                                        <Typography variant="subtitle2" noWrap>
                                            {product.name}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {product.sale_price.toFixed(2)}
                                        </Typography>
                                    </CardContent>
                                </CardActionArea>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </Grid>

            <Grid item xs={12} md={5}>
                <Paper sx={{ p: 2 }}>
                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                        <TextField
                            select
                            label={t('nav.customers')}
                            value={customerId}
                            onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : '')}
                            sx={{ flex: 1 }}
                        >
                            <MenuItem value="">Walk-in</MenuItem>
                            {customers?.map((c) => (
                                <MenuItem key={c.id} value={c.id}>
                                    {c.name}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            select
                            label={t('nav.inventory')}
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

                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('nav.products')}</TableCell>
                                <TableCell align="right">Qty</TableCell>
                                <TableCell align="right">Total</TableCell>
                                <TableCell />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {cart.map((line) => (
                                <TableRow key={line.product.id}>
                                    <TableCell>{line.product.name}</TableCell>
                                    <TableCell align="right">
                                        <TextField
                                            type="number"
                                            size="small"
                                            value={line.quantity}
                                            onChange={(e) =>
                                                updateQuantity(line.product.id, Number(e.target.value))
                                            }
                                            sx={{ width: 70 }}
                                        />
                                    </TableCell>
                                    <TableCell align="right">
                                        {(line.quantity * line.product.sale_price).toFixed(2)}
                                    </TableCell>
                                    <TableCell>
                                        <IconButton size="small" onClick={() => removeLine(line.product.id)}>
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    <Typography variant="h5" align="right" sx={{ mt: 2 }}>
                        {grandTotal.toFixed(2)}
                    </Typography>

                    <Typography variant="subtitle1" sx={{ mt: 2 }}>
                        Payment
                    </Typography>
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
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Stack>
                    ))}
                    <Button size="small" onClick={addTender} sx={{ mt: 1 }} disabled={!cashAccounts?.length}>
                        {t('actions.add')} tender
                    </Button>

                    <Typography variant="body2" sx={{ mt: 1 }} color={remaining > 0 ? 'error' : 'text.secondary'}>
                        {remaining > 0 ? `Remaining: ${remaining.toFixed(2)}` : 'Fully paid'}
                    </Typography>

                    <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        sx={{ mt: 2 }}
                        disabled={cart.length === 0 || mutation.isPending || (customerId === '' && remaining !== 0)}
                        onClick={checkout}
                    >
                        Complete sale
                    </Button>
                </Paper>
            </Grid>
        </Grid>
    );
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}
