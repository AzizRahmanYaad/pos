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
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LoadingButton } from '@/components/LoadingButton';
import { fetchSuppliers } from '@/features/suppliers/api';
import { fetchWarehouses } from '@/features/warehouses/api';
import { fetchProducts } from '@/features/products/api';
import { createPurchase, type PurchaseItemPayload } from '@/features/purchases/api';
import { fetchCashAccounts } from '@/features/cash-accounts/api';
import { fetchExpenseCategories, createExpenseCategory, createExpense } from '@/features/expenses/api';
import { DualDateField } from '@/components/DualDateField';

function todayIso(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

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
    const { data: cashAccounts } = useQuery({ queryKey: ['cash-accounts'], queryFn: fetchCashAccounts });
    const { data: categories } = useQuery({ queryKey: ['expense-categories'], queryFn: fetchExpenseCategories });

    const [supplierId, setSupplierId] = useState<number | ''>('');
    const [warehouseId, setWarehouseId] = useState<number | ''>('');
    const [purchaseDate, setPurchaseDate] = useState<string>(todayIso());
    const [landedCostAmount, setLandedCostAmount] = useState('');
    const [landedCostDescription, setLandedCostDescription] = useState('');
    const [landedCostCategoryId, setLandedCostCategoryId] = useState<number | ''>('');
    const [landedCostCashAccountId, setLandedCostCashAccountId] = useState<number | ''>('');
    const [newCategoryName, setNewCategoryName] = useState('');
    const [items, setItems] = useState<ItemRow[]>([]);
    const [error, setError] = useState<string | null>(null);

    const categoryMutation = useMutation({
        mutationFn: createExpenseCategory,
        onSuccess: (category) => {
            queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
            setLandedCostCategoryId(category.id);
            setNewCategoryName('');
        },
    });

    const landedCostFilled = landedCostAmount !== '';
    const landedCostValid = !landedCostFilled || (landedCostCategoryId !== '' && landedCostCashAccountId !== '');

    const mutation = useMutation({
        mutationFn: async () => {
            const purchase = await createPurchase({
                supplier_id: supplierId as number,
                warehouse_id: warehouseId as number,
                purchase_date: purchaseDate || todayIso(),
                items: items.map(({ product_id, quantity, unit_id, unit_cost }) => ({
                    product_id,
                    quantity,
                    unit_id,
                    unit_cost,
                })),
                landed_costs: [],
            });

            // The landed cost becomes a real, paid expense — categorized and
            // debited from the chosen cash resource — rather than a bare
            // number with no accounting trail. It's linked to this purchase
            // so it's still allocated across the items once received.
            if (landedCostFilled && landedCostCategoryId && landedCostCashAccountId) {
                await createExpense({
                    expense_category_id: landedCostCategoryId,
                    cash_account_id: landedCostCashAccountId,
                    amount: Number(landedCostAmount),
                    description: landedCostDescription || undefined,
                    is_landed_cost: true,
                    purchase_id: purchase.id,
                });
            }

            return purchase;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchases'] });
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            queryClient.invalidateQueries({ queryKey: ['cash-accounts'] });
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
        if (!supplierId || !warehouseId || items.length === 0 || !landedCostValid) return;
        mutation.mutate();
    };

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                {t('purchases_page.title')}
            </Typography>

            <Paper sx={{ p: 3 }}>
                <Stack spacing={2}>
                    {error && <Alert severity="error">{error}</Alert>}

                    <Stack direction="row" spacing={2} alignItems="flex-start" flexWrap="wrap" useFlexGap>
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
                        <DualDateField label={t('fields.date')} value={purchaseDate} onChange={setPurchaseDate} />
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
                    <Typography variant="caption" color="text.secondary">
                        {t('purchases_page.landed_cost_expense_hint')}
                    </Typography>
                    <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="flex-start">
                        <TextField
                            label={t('purchases_page.landed_cost_description')}
                            value={landedCostDescription}
                            onChange={(e) => setLandedCostDescription(e.target.value)}
                            sx={{ minWidth: 220 }}
                        />
                        <TextField
                            label={t('fields.amount')}
                            type="number"
                            value={landedCostAmount}
                            onChange={(e) => setLandedCostAmount(e.target.value)}
                            sx={{ width: 140 }}
                        />
                        <TextField
                            select
                            label={t('fields.category')}
                            value={landedCostCategoryId}
                            onChange={(e) => setLandedCostCategoryId(Number(e.target.value))}
                            sx={{ minWidth: 200 }}
                            error={landedCostFilled && landedCostCategoryId === ''}
                        >
                            {categories?.map((c) => (
                                <MenuItem key={c.id} value={c.id}>
                                    {c.name}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            select
                            label={t('fields.cash_account')}
                            value={landedCostCashAccountId}
                            onChange={(e) => setLandedCostCashAccountId(Number(e.target.value))}
                            sx={{ minWidth: 200 }}
                            error={landedCostFilled && landedCostCashAccountId === ''}
                        >
                            {cashAccounts?.map((a) => (
                                <MenuItem key={a.id} value={a.id}>
                                    {a.name}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <TextField
                            size="small"
                            label={t('expenses_page.new_category')}
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            sx={{ minWidth: 200 }}
                        />
                        <LoadingButton
                            size="small"
                            startIcon={<AddIcon />}
                            loading={categoryMutation.isPending}
                            disabled={!newCategoryName}
                            onClick={() => categoryMutation.mutate(newCategoryName)}
                        >
                            {t('actions.add')}
                        </LoadingButton>
                    </Stack>

                    <Typography variant="subtitle1">{t('fields.subtotal')}: {total.toFixed(2)}</Typography>

                    <Stack direction="row" spacing={2}>
                        <LoadingButton
                            variant="contained"
                            onClick={submit}
                            loading={mutation.isPending}
                            disabled={!supplierId || !warehouseId || items.length === 0 || !landedCostValid}
                        >
                            {t('actions.save')}
                        </LoadingButton>
                        <Button onClick={() => navigate('/purchases')}>{t('actions.cancel')}</Button>
                    </Stack>
                </Stack>
            </Paper>
        </Box>
    );
}
