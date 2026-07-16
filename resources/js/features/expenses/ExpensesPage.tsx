import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
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
import { fetchExpenses, fetchExpenseCategories, createExpense, createExpenseCategory } from '@/features/expenses/api';
import { fetchCashAccounts } from '@/features/cash-accounts/api';
import { fetchPurchases } from '@/features/purchases/api';

export function ExpensesPage() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    const { data: expenses } = useQuery({ queryKey: ['expenses'], queryFn: fetchExpenses });
    const { data: categories } = useQuery({ queryKey: ['expense-categories'], queryFn: fetchExpenseCategories });
    const { data: cashAccounts } = useQuery({ queryKey: ['cash-accounts'], queryFn: fetchCashAccounts });
    const { data: purchases } = useQuery({ queryKey: ['purchases'], queryFn: fetchPurchases });

    const [dialogOpen, setDialogOpen] = useState(false);
    const [categoryId, setCategoryId] = useState<number | ''>('');
    const [cashAccountId, setCashAccountId] = useState<number | ''>('');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [isLandedCost, setIsLandedCost] = useState(false);
    const [purchaseId, setPurchaseId] = useState<number | ''>('');
    const [newCategoryName, setNewCategoryName] = useState('');
    const [error, setError] = useState<string | null>(null);

    const draftPurchases = purchases?.filter((p) => p.status === 'draft') ?? [];

    const categoryMutation = useMutation({
        mutationFn: createExpenseCategory,
        onSuccess: (category) => {
            queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
            setCategoryId(category.id);
            setNewCategoryName('');
        },
    });

    const mutation = useMutation({
        mutationFn: createExpense,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            queryClient.invalidateQueries({ queryKey: ['purchases'] });
            setDialogOpen(false);
            setAmount('');
            setDescription('');
            setIsLandedCost(false);
            setPurchaseId('');
            setError(null);
        },
        onError: () => setError('Could not save expense — check a draft purchase is selected for landed costs.'),
    });

    const submit = () => {
        if (!categoryId || !cashAccountId || !amount) return;
        mutation.mutate({
            expense_category_id: categoryId,
            cash_account_id: cashAccountId,
            amount: Number(amount),
            description: description || undefined,
            is_landed_cost: isLandedCost,
            purchase_id: isLandedCost && purchaseId ? purchaseId : undefined,
        });
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4">{t('nav.expenses')}</Typography>
                <Button variant="contained" onClick={() => setDialogOpen(true)}>
                    {t('actions.add')}
                </Button>
            </Box>

            {expenses && (
                <TableContainer component={Paper}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Category</TableCell>
                                <TableCell>Description</TableCell>
                                <TableCell>Landed cost</TableCell>
                                <TableCell align="right">Amount</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {expenses.map((expense) => (
                                <TableRow key={expense.id}>
                                    <TableCell>{expense.category_name}</TableCell>
                                    <TableCell>{expense.description ?? '—'}</TableCell>
                                    <TableCell>
                                        {expense.is_landed_cost ? expense.purchase_number ?? 'Yes' : '—'}
                                    </TableCell>
                                    <TableCell align="right">{expense.amount.toFixed(2)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>New expense</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        {error && <Alert severity="error">{error}</Alert>}
                        <TextField
                            select
                            label="Category"
                            value={categoryId}
                            onChange={(e) => setCategoryId(Number(e.target.value))}
                            fullWidth
                        >
                            {categories?.map((c) => (
                                <MenuItem key={c.id} value={c.id}>
                                    {c.name}
                                </MenuItem>
                            ))}
                        </TextField>
                        <Stack direction="row" spacing={1}>
                            <TextField
                                size="small"
                                label="New category"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                fullWidth
                            />
                            <Button
                                size="small"
                                disabled={!newCategoryName || categoryMutation.isPending}
                                onClick={() => categoryMutation.mutate(newCategoryName)}
                            >
                                {t('actions.add')}
                            </Button>
                        </Stack>
                        <TextField
                            select
                            label="Cash account"
                            value={cashAccountId}
                            onChange={(e) => setCashAccountId(Number(e.target.value))}
                            fullWidth
                        >
                            {cashAccounts?.map((a) => (
                                <MenuItem key={a.id} value={a.id}>
                                    {a.name}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            label="Amount"
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            fullWidth
                        />
                        <TextField
                            label="Description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            fullWidth
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={isLandedCost}
                                    onChange={(e) => setIsLandedCost(e.target.checked)}
                                />
                            }
                            label="Landed cost (adds to a draft purchase's stock cost)"
                        />
                        {isLandedCost && (
                            <TextField
                                select
                                label="Draft purchase"
                                value={purchaseId}
                                onChange={(e) => setPurchaseId(Number(e.target.value))}
                                fullWidth
                            >
                                {draftPurchases.map((p) => (
                                    <MenuItem key={p.id} value={p.id}>
                                        {p.purchase_number} — {p.supplier_name}
                                    </MenuItem>
                                ))}
                            </TextField>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>{t('actions.cancel')}</Button>
                    <Button
                        variant="contained"
                        onClick={submit}
                        disabled={mutation.isPending || !categoryId || !cashAccountId || !amount}
                    >
                        {t('actions.save')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
