import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Alert,
    Box,
    Button,
    IconButton,
    MenuItem,
    Paper,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchSuppliers } from '@/features/suppliers/api';
import { fetchWarehouses } from '@/features/warehouses/api';
import { fetchProducts } from '@/features/products/api';
import { createPurchase, type PurchaseItemPayload } from '@/features/purchases/api';

interface ItemRow extends PurchaseItemPayload {
    key: number;
}

let rowKey = 0;

export function NewPurchasePage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: fetchSuppliers });
    const { data: warehouses } = useQuery({ queryKey: ['warehouses'], queryFn: fetchWarehouses });
    const { data: products } = useQuery({ queryKey: ['products'], queryFn: fetchProducts });

    const [supplierId, setSupplierId] = useState<number | ''>('');
    const [warehouseId, setWarehouseId] = useState<number | ''>('');
    const [landedCostAmount, setLandedCostAmount] = useState('');
    const [landedCostDescription, setLandedCostDescription] = useState('');
    const [items, setItems] = useState<ItemRow[]>([]);
    const [error, setError] = useState<string | null>(null);

    const mutation = useMutation({
        mutationFn: createPurchase,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchases'] });
            navigate('/purchases');
        },
        onError: () => setError(t('purchases_page.create_failed')),
    });

    const addItem = () => {
        const first = products?.[0];
        if (!first) return;
        setItems((prev) => [
            ...prev,
            { key: rowKey++, product_id: first.id, quantity: 1, unit_id: first.unit_id, unit_cost: first.default_cost },
        ]);
    };

    const updateItem = (key: number, patch: Partial<ItemRow>) => {
        setItems((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    };

    const removeItem = (key: number) => setItems((prev) => prev.filter((row) => row.key !== key));

    const total = items.reduce((sum, row) => sum + row.quantity * row.unit_cost, 0);

    const submit = () => {
        if (!supplierId || !warehouseId || items.length === 0) return;
        mutation.mutate({
            supplier_id: supplierId,
            warehouse_id: warehouseId,
            purchase_date: new Date().toISOString(),
            items: items.map(({ product_id, quantity, unit_id, unit_cost }) => ({
                product_id,
                quantity,
                unit_id,
                unit_cost,
            })),
            landed_costs:
                landedCostAmount && landedCostDescription
                    ? [{ description: landedCostDescription, amount: Number(landedCostAmount) }]
                    : [],
        });
    };

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                {t('purchases_page.title')}
            </Typography>

            <Paper sx={{ p: 3 }}>
                <Stack spacing={2}>
                    {error && <Alert severity="error">{error}</Alert>}

                    <Stack direction="row" spacing={2}>
                        <TextField
                            select
                            label={t('nav.suppliers')}
                            value={supplierId}
                            onChange={(e) => setSupplierId(Number(e.target.value))}
                            sx={{ minWidth: 240 }}
                        >
                            {suppliers?.map((s) => (
                                <MenuItem key={s.id} value={s.id}>
                                    {s.name}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            select
                            label={t('fields.warehouse')}
                            value={warehouseId}
                            onChange={(e) => setWarehouseId(Number(e.target.value))}
                            sx={{ minWidth: 240 }}
                        >
                            {warehouses?.map((w) => (
                                <MenuItem key={w.id} value={w.id}>
                                    {w.name}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Stack>

                    <Typography variant="h6">{t('purchases_page.items')}</Typography>
                    {items.map((row) => (
                        <Stack direction="row" spacing={2} alignItems="center" key={row.key}>
                            <TextField
                                select
                                label={t('nav.products')}
                                value={row.product_id}
                                onChange={(e) => {
                                    const product = products?.find((p) => p.id === Number(e.target.value));
                                    updateItem(row.key, {
                                        product_id: Number(e.target.value),
                                        unit_id: product?.unit_id ?? row.unit_id,
                                    });
                                }}
                                sx={{ minWidth: 220 }}
                            >
                                {products?.map((p) => (
                                    <MenuItem key={p.id} value={p.id}>
                                        {p.name}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                label={t('fields.quantity')}
                                type="number"
                                value={row.quantity}
                                onChange={(e) => updateItem(row.key, { quantity: Number(e.target.value) })}
                                sx={{ width: 120 }}
                            />
                            <TextField
                                label={t('fields.unit_cost')}
                                type="number"
                                value={row.unit_cost}
                                onChange={(e) => updateItem(row.key, { unit_cost: Number(e.target.value) })}
                                sx={{ width: 140 }}
                            />
                            <IconButton onClick={() => removeItem(row.key)} aria-label="remove">
                                <DeleteIcon />
                            </IconButton>
                        </Stack>
                    ))}
                    <Button onClick={addItem} sx={{ alignSelf: 'flex-start' }}>
                        {t('purchases_page.add_item')}
                    </Button>

                    <Typography variant="h6">{t('purchases_page.landed_cost')}</Typography>
                    <Stack direction="row" spacing={2}>
                        <TextField
                            label={t('purchases_page.landed_cost_description')}
                            value={landedCostDescription}
                            onChange={(e) => setLandedCostDescription(e.target.value)}
                            sx={{ minWidth: 240 }}
                        />
                        <TextField
                            label={t('fields.amount')}
                            type="number"
                            value={landedCostAmount}
                            onChange={(e) => setLandedCostAmount(e.target.value)}
                            sx={{ width: 160 }}
                        />
                    </Stack>

                    <Typography variant="subtitle1">{t('fields.subtotal')}: {total.toFixed(2)}</Typography>

                    <Stack direction="row" spacing={2}>
                        <Button
                            variant="contained"
                            onClick={submit}
                            disabled={mutation.isPending || !supplierId || !warehouseId || items.length === 0}
                        >
                            {t('actions.save')}
                        </Button>
                        <Button onClick={() => navigate('/purchases')}>{t('actions.cancel')}</Button>
                    </Stack>
                </Stack>
            </Paper>
        </Box>
    );
}
