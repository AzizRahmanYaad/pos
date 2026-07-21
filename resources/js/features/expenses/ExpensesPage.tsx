import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    Grid,
    LinearProgress,
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
    Tooltip,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { useTranslation } from 'react-i18next';
import {
    fetchExpenses,
    fetchExpenseCategories,
    fetchExpenseSummary,
    downloadExpenseReportPdf,
    createExpense,
    createExpenseCategory,
} from '@/features/expenses/api';
import { fetchCashAccounts } from '@/features/cash-accounts/api';
import { fetchPurchases } from '@/features/purchases/api';
import { fetchBusinessSettings } from '@/features/settings/api';
import { DualDateField } from '@/components/DualDateField';

export function ExpensesPage() {
    const { t } = useTranslation();
    const theme = useTheme();
    const queryClient = useQueryClient();

    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const range = useMemo(() => ({ from: from || undefined, to: to || undefined }), [from, to]);

    const { data: expenses } = useQuery({
        queryKey: ['expenses', range],
        queryFn: () => fetchExpenses(range),
    });
    const { data: summary } = useQuery({
        queryKey: ['expenses-summary', range],
        queryFn: () => fetchExpenseSummary(range),
    });
    const { data: categories } = useQuery({ queryKey: ['expense-categories'], queryFn: fetchExpenseCategories });
    const { data: cashAccounts } = useQuery({ queryKey: ['cash-accounts'], queryFn: fetchCashAccounts });
    const { data: purchases } = useQuery({ queryKey: ['purchases'], queryFn: () => fetchPurchases() });
    const { data: settings } = useQuery({ queryKey: ['business-settings'], queryFn: fetchBusinessSettings });

    const [dialogOpen, setDialogOpen] = useState(false);
    const [categoryId, setCategoryId] = useState<number | ''>('');
    const [cashAccountId, setCashAccountId] = useState<number | ''>('');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [isLandedCost, setIsLandedCost] = useState(false);
    const [purchaseId, setPurchaseId] = useState<number | ''>('');
    const [newCategoryName, setNewCategoryName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busyPdf, setBusyPdf] = useState(false);

    const draftPurchases = purchases?.filter((p) => p.status === 'draft') ?? [];

    const money = (v: number) =>
        v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const sym = settings?.currency_symbol ?? '';
    const withSym = (v: number) => `${money(v)}${sym ? ` ${sym}` : ''}`;

    const categoryMutation = useMutation({
        mutationFn: createExpenseCategory,
        onSuccess: (category) => {
            queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
            setCategoryId(category.id);
            setNewCategoryName('');
        },
    });

    const invalidateExpenses = () => {
        queryClient.invalidateQueries({ queryKey: ['expenses'] });
        queryClient.invalidateQueries({ queryKey: ['expenses-summary'] });
    };

    const mutation = useMutation({
        mutationFn: createExpense,
        onSuccess: () => {
            invalidateExpenses();
            queryClient.invalidateQueries({ queryKey: ['purchases'] });
            setDialogOpen(false);
            setAmount('');
            setDescription('');
            setIsLandedCost(false);
            setPurchaseId('');
            setError(null);
        },
        onError: () => setError(t('expenses_page.save_failed')),
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

    const openPdf = async (print: boolean) => {
        setBusyPdf(true);
        try {
            const { url } = await downloadExpenseReportPdf(range);
            const win = window.open(url, '_blank');
            if (print && win) {
                win.addEventListener('load', () => setTimeout(() => win.print(), 400));
            }
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } finally {
            setBusyPdf(false);
        }
    };

    const shareWhatsApp = async () => {
        setBusyPdf(true);
        try {
            const { url, filename, blob } = await downloadExpenseReportPdf(range);
            const period = from || to ? `${from || '…'} — ${to || '…'}` : t('expenses_page.all_dates');
            const message = t('expenses_page.wa_message', {
                company: settings?.company_name ?? '',
                period,
                total: withSym(summary?.grand_total ?? 0),
            });
            const file = new File([blob], filename, { type: 'application/pdf' });

            const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
            if (nav.canShare?.({ files: [file] })) {
                try {
                    await nav.share({ files: [file], text: message });
                    return;
                } catch {
                    /* cancelled */
                }
            }

            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = filename;
            anchor.click();
            window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } finally {
            setBusyPdf(false);
        }
    };

    const maxCategoryTotal = summary?.categories.reduce((m, c) => Math.max(m, c.total), 0) ?? 0;

    return (
        <Box>
            {/* Header */}
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="h4" fontWeight={800}>
                        {t('nav.expenses')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {t('expenses_page.subtitle')}
                    </Typography>
                </Box>
                <Button variant="contained" size="large" onClick={() => setDialogOpen(true)}>
                    {t('expenses_page.new_expense')}
                </Button>
            </Stack>

            {/* Toolbar: date range + report actions */}
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 2.5 }}>
                <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1.5}
                    alignItems={{ md: 'flex-start' }}
                    flexWrap="wrap"
                    useFlexGap
                >
                    <DualDateField label={t('fields.from')} value={from} onChange={setFrom} />
                    <DualDateField label={t('fields.to')} value={to} onChange={setTo} />
                    {(from || to) && (
                        <Button size="small" color="inherit" onClick={() => { setFrom(''); setTo(''); }}>
                            {t('expenses_page.clear_dates')}
                        </Button>
                    )}
                    <Box sx={{ flexGrow: 1 }} />
                    <Button
                        variant="outlined"
                        startIcon={<PrintOutlinedIcon />}
                        disabled={busyPdf}
                        onClick={() => openPdf(true)}
                    >
                        {t('purchases_page.print')}
                    </Button>
                    <Tooltip title={t('ledger.download_pdf')}>
                        <span>
                            <Button
                                variant="outlined"
                                startIcon={<PictureAsPdfOutlinedIcon />}
                                disabled={busyPdf}
                                onClick={() => openPdf(false)}
                            >
                                PDF
                            </Button>
                        </span>
                    </Tooltip>
                    <Button
                        variant="contained"
                        startIcon={<WhatsAppIcon />}
                        disabled={busyPdf}
                        onClick={shareWhatsApp}
                        sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#1da851' } }}
                    >
                        {t('ledger.whatsapp')}
                    </Button>
                </Stack>
                {busyPdf && <LinearProgress sx={{ mt: 1.5, borderRadius: 1 }} />}
            </Paper>

            {/* Report summary: grand total + category-wise breakdown */}
            <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
                <Grid item xs={12} md={4}>
                    <Paper
                        sx={{
                            p: 3,
                            borderRadius: 3,
                            height: '100%',
                            color: '#fff',
                            background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
                        }}
                    >
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <ReceiptLongOutlinedIcon />
                            <Typography variant="overline" sx={{ opacity: 0.9 }}>
                                {t('expenses_page.total_expenses')}
                            </Typography>
                        </Stack>
                        <Typography variant="h3" fontWeight={800} sx={{ mt: 1 }}>
                            {withSym(summary?.grand_total ?? 0)}
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5 }}>
                            {t('expenses_page.count', { count: summary?.count ?? 0 })}
                            {(from || to) && ` · ${from || '…'} — ${to || '…'}`}
                        </Typography>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={8}>
                    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
                            {t('expenses_page.by_category')}
                        </Typography>
                        {summary && summary.categories.length > 0 ? (
                            <Stack spacing={1.25}>
                                {summary.categories.map((c) => (
                                    <Box key={c.category_name}>
                                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                                            <Typography variant="body2" fontWeight={600}>
                                                {c.category_name}{' '}
                                                <Typography component="span" variant="caption" color="text.secondary">
                                                    ({c.count})
                                                </Typography>
                                            </Typography>
                                            <Typography variant="body2" fontWeight={700}>
                                                {withSym(c.total)}
                                            </Typography>
                                        </Stack>
                                        <Box sx={{ height: 6, borderRadius: 3, bgcolor: alpha(theme.palette.primary.main, 0.12) }}>
                                            <Box
                                                sx={{
                                                    height: '100%',
                                                    borderRadius: 3,
                                                    bgcolor: 'primary.main',
                                                    width: `${maxCategoryTotal ? (c.total / maxCategoryTotal) * 100 : 0}%`,
                                                }}
                                            />
                                        </Box>
                                    </Box>
                                ))}
                            </Stack>
                        ) : (
                            <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                                {t('expenses_page.no_expenses')}
                            </Typography>
                        )}
                    </Paper>
                </Grid>
            </Grid>

            {/* Detail list */}
            <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700}>
                        {t('expenses_page.details')}
                    </Typography>
                    {summary && (
                        <Chip
                            variant="outlined"
                            size="small"
                            label={t('expenses_page.count', { count: summary.count })}
                        />
                    )}
                </Stack>
                <Divider />
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                                <TableCell>{t('fields.date')}</TableCell>
                                <TableCell>{t('fields.category')}</TableCell>
                                <TableCell>{t('fields.description')}</TableCell>
                                <TableCell>{t('expenses_page.landed_cost_column')}</TableCell>
                                <TableCell align="right">{t('fields.amount')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {expenses?.map((expense) => (
                                <TableRow key={expense.id} hover>
                                    <TableCell>{expense.expense_date?.slice(0, 10)}</TableCell>
                                    <TableCell>{expense.category_name}</TableCell>
                                    <TableCell>{expense.description ?? '—'}</TableCell>
                                    <TableCell>
                                        {expense.is_landed_cost
                                            ? expense.purchase_number ?? t('common.yes')
                                            : t('common.none')}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                                        {withSym(expense.amount)}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {expenses && expenses.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5}>
                                        <Box sx={{ py: 6, textAlign: 'center' }}>
                                            <ReceiptLongOutlinedIcon
                                                sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }}
                                            />
                                            <Typography color="text.secondary">
                                                {t('expenses_page.no_expenses')}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>{t('expenses_page.new_expense')}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        {error && <Alert severity="error">{error}</Alert>}
                        <TextField
                            select
                            label={t('fields.category')}
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
                                label={t('expenses_page.new_category')}
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
                            label={t('fields.cash_account')}
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
                            label={t('fields.amount')}
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            fullWidth
                        />
                        <TextField
                            label={t('fields.description')}
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
                            label={t('expenses_page.landed_cost_checkbox')}
                        />
                        {isLandedCost && (
                            <TextField
                                select
                                label={t('expenses_page.draft_purchase')}
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
