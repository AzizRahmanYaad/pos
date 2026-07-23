import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Box,
    Chip,
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
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { BrandSpinner } from '@/components/BrandSpinner';
import {
    fetchProfitLoss,
    fetchInventoryValuation,
    fetchSalesSummary,
    fetchPurchaseSummary,
    fetchExpensesByCategory,
    fetchReceivables,
    fetchPayables,
    downloadProfitLossPdf,
    downloadInventoryValuationPdf,
    downloadSalesSummaryPdf,
    downloadPurchaseSummaryPdf,
    downloadExpensesByCategoryPdf,
    downloadReceivablesPdf,
    downloadPayablesPdf,
} from '@/features/reports/api';
import {
    fetchCashAccounts,
    fetchCashAccountLedger,
    downloadCashAccountLedgerPdf,
} from '@/features/cash-accounts/api';
import { fetchBusinessSettings } from '@/features/settings/api';
import { DualDateField } from '@/components/DualDateField';
import { ReportActions } from '@/components/ReportActions';
import { formatDate } from '@/lib/calendar';

type ReportTab =
    | 'profit-loss'
    | 'sales-summary'
    | 'purchase-summary'
    | 'expenses-by-category'
    | 'inventory'
    | 'receivables'
    | 'payables'
    | 'cash';

const DATE_RANGE_TABS: ReportTab[] = ['profit-loss', 'sales-summary', 'purchase-summary', 'expenses-by-category', 'cash'];
const GROUP_BY_TABS: ReportTab[] = ['sales-summary', 'purchase-summary'];

function startOfMonth(): string {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
}

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

export function ReportsPage() {
    const { t, i18n } = useTranslation();
    const theme = useTheme();
    const [from, setFrom] = useState(startOfMonth());
    const [to, setTo] = useState(today());
    const [tab, setTab] = useState<ReportTab>('profit-loss');
    const [groupBy, setGroupBy] = useState<'day' | 'month'>('day');
    const [cashAccountId, setCashAccountId] = useState<number | ''>('');
    const [cashPage, setCashPage] = useState(0);
    const cashPerPage = 25;

    const { data: settings } = useQuery({ queryKey: ['business-settings'], queryFn: fetchBusinessSettings });
    const sym = settings?.currency_symbol ?? '';
    const companyName = settings?.company_name ?? '';
    const money = (v: number) =>
        `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${sym ? ` ${sym}` : ''}`;

    const { data: pnl, isFetching: pnlLoading } = useQuery({
        queryKey: ['report-pnl', from, to],
        queryFn: () => fetchProfitLoss(from, to),
        enabled: tab === 'profit-loss',
    });

    const { data: valuation, isFetching: valuationLoading } = useQuery({
        queryKey: ['report-inventory-valuation'],
        queryFn: fetchInventoryValuation,
        enabled: tab === 'inventory',
    });

    const { data: salesRows, isFetching: salesLoading } = useQuery({
        queryKey: ['report-sales-summary', from, to, groupBy],
        queryFn: () => fetchSalesSummary(from, to, groupBy),
        enabled: tab === 'sales-summary',
    });

    const { data: purchaseRows, isFetching: purchasesLoading } = useQuery({
        queryKey: ['report-purchase-summary', from, to, groupBy],
        queryFn: () => fetchPurchaseSummary(from, to, groupBy),
        enabled: tab === 'purchase-summary',
    });

    const { data: cashAccounts } = useQuery({
        queryKey: ['cash-accounts'],
        queryFn: fetchCashAccounts,
        enabled: tab === 'cash',
    });
    const activeCashAccounts = (cashAccounts ?? []).filter((a) => a.is_active);

    useEffect(() => {
        if (tab === 'cash' && cashAccountId === '' && activeCashAccounts.length > 0) {
            setCashAccountId(activeCashAccounts[0].id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, activeCashAccounts.length]);

    const { data: cashLedger, isFetching: cashLoading } = useQuery({
        queryKey: ['report-cash-ledger', cashAccountId, cashPage, cashPerPage, from, to],
        queryFn: () =>
            fetchCashAccountLedger(cashAccountId as number, {
                page: cashPage + 1,
                perPage: cashPerPage,
                from: from || undefined,
                to: to || undefined,
            }),
        enabled: tab === 'cash' && cashAccountId !== '',
    });

    const { data: expenseRows, isFetching: expensesLoading } = useQuery({
        queryKey: ['report-expenses-by-category', from, to],
        queryFn: () => fetchExpensesByCategory(from, to),
        enabled: tab === 'expenses-by-category',
    });

    const { data: receivables, isFetching: receivablesLoading } = useQuery({
        queryKey: ['report-receivables'],
        queryFn: fetchReceivables,
        enabled: tab === 'receivables',
    });

    const { data: payables, isFetching: payablesLoading } = useQuery({
        queryKey: ['report-payables'],
        queryFn: fetchPayables,
        enabled: tab === 'payables',
    });

    const isLoading =
        pnlLoading ||
        valuationLoading ||
        salesLoading ||
        purchasesLoading ||
        expensesLoading ||
        receivablesLoading ||
        payablesLoading ||
        (tab === 'cash' && cashLoading);

    const download = useMemo(() => {
        switch (tab) {
            case 'profit-loss':
                return () => downloadProfitLossPdf(from, to);
            case 'sales-summary':
                return () => downloadSalesSummaryPdf(from, to);
            case 'purchase-summary':
                return () => downloadPurchaseSummaryPdf(from, to, groupBy);
            case 'expenses-by-category':
                return () => downloadExpensesByCategoryPdf(from, to);
            case 'inventory':
                return () => downloadInventoryValuationPdf();
            case 'receivables':
                return () => downloadReceivablesPdf();
            case 'payables':
                return () => downloadPayablesPdf();
            case 'cash':
                return cashAccountId !== ''
                    ? () => downloadCashAccountLedgerPdf(cashAccountId, { from: from || undefined, to: to || undefined })
                    : undefined;
        }
    }, [tab, from, to, groupBy, cashAccountId]);

    const waMessage = useMemo(() => {
        switch (tab) {
            case 'profit-loss':
                return t('reports_page.wa_profit_loss', { company: companyName, net: pnl ? money(pnl.net_profit) : '' });
            case 'sales-summary':
                return t('reports_page.wa_sales_summary', { company: companyName, period: `${from} — ${to}` });
            case 'purchase-summary':
                return t('reports_page.wa_purchase_summary', { company: companyName, period: `${from} — ${to}` });
            case 'expenses-by-category':
                return t('reports_page.wa_expenses_by_category', { company: companyName, period: `${from} — ${to}` });
            case 'inventory':
                return t('reports_page.wa_inventory', {
                    company: companyName,
                    total: valuation ? money(valuation.total_value) : '',
                });
            case 'receivables':
                return t('reports_page.wa_receivables', {
                    company: companyName,
                    total: receivables ? money(receivables.total) : '',
                });
            case 'payables':
                return t('reports_page.wa_payables', { company: companyName, total: payables ? money(payables.total) : '' });
            case 'cash':
                return t('reports_page.wa_cash', {
                    company: companyName,
                    total: cashLedger ? money(cashLedger.current_balance) : '',
                });
        }
    }, [tab, companyName, from, to, pnl, valuation, receivables, payables, cashLedger, sym]);

    return (
        <Box>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" fontWeight={800}>
                    {t('nav.reports')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {t('reports_page.subtitle')}
                </Typography>
            </Box>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 2.5 }}>
                <Stack direction="row" spacing={2} alignItems="flex-start" flexWrap="wrap" useFlexGap>
                    <TextField
                        select
                        size="small"
                        label={t('reports_page.report_label')}
                        value={tab}
                        onChange={(e) => setTab(e.target.value as ReportTab)}
                        sx={{ minWidth: 220 }}
                    >
                        <MenuItem value="profit-loss">{t('reports_page.profit_loss')}</MenuItem>
                        <MenuItem value="sales-summary">{t('reports_page.sales_summary')}</MenuItem>
                        <MenuItem value="purchase-summary">{t('reports_page.purchase_summary')}</MenuItem>
                        <MenuItem value="expenses-by-category">{t('reports_page.expenses_by_category')}</MenuItem>
                        <MenuItem value="inventory">{t('reports_page.inventory_valuation')}</MenuItem>
                        <MenuItem value="receivables">{t('reports_page.receivables')}</MenuItem>
                        <MenuItem value="payables">{t('reports_page.payables')}</MenuItem>
                        <MenuItem value="cash">{t('reports_page.cash_report')}</MenuItem>
                    </TextField>
                    {tab === 'cash' && (
                        <TextField
                            select
                            size="small"
                            label={t('fields.cash_account')}
                            value={cashAccountId}
                            onChange={(e) => {
                                setCashAccountId(Number(e.target.value));
                                setCashPage(0);
                            }}
                            sx={{ minWidth: 200 }}
                        >
                            {activeCashAccounts.map((account) => (
                                <MenuItem key={account.id} value={account.id}>
                                    {account.name}
                                </MenuItem>
                            ))}
                        </TextField>
                    )}
                    {DATE_RANGE_TABS.includes(tab) && (
                        <>
                            <DualDateField label={t('fields.from')} value={from} onChange={setFrom} />
                            <DualDateField label={t('fields.to')} value={to} onChange={setTo} />
                        </>
                    )}
                    {GROUP_BY_TABS.includes(tab) && (
                        <ToggleButtonGroup
                            size="small"
                            value={groupBy}
                            exclusive
                            onChange={(_, next) => next && setGroupBy(next)}
                            sx={{ mt: 0.5 }}
                        >
                            <ToggleButton value="day">{t('reports_page.by_day')}</ToggleButton>
                            <ToggleButton value="month">{t('reports_page.by_month')}</ToggleButton>
                        </ToggleButtonGroup>
                    )}
                    <Box sx={{ flexGrow: 1 }} />
                    <ReportActions download={download} message={waMessage} />
                </Stack>
            </Paper>

            {isLoading && <BrandSpinner fullPage minHeight={240} label={t('common.loading')} />}

            {!isLoading && tab === 'profit-loss' && pnl && (
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, maxWidth: 640 }}>
                    <Typography variant="overline" color="text.secondary" dir="ltr" sx={{ display: 'block', mb: 1 }}>
                        {pnl.from} — {pnl.to}
                    </Typography>
                    <Stack spacing={1.25}>
                        <PnlRow label={t('fields.revenue')} value={money(pnl.revenue)} />
                        <PnlRow label={t('fields.cogs')} value={`−${money(pnl.cogs)}`} muted />
                        <PnlRow label={t('fields.gross_profit')} value={money(pnl.gross_profit)} bold divider />
                    </Stack>

                    <Box sx={{ mt: 2.5, mb: 2, p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.text.primary, 0.03) }}>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                            {t('reports_page.operating_expenses_by_category')}
                        </Typography>
                        {pnl.operating_expenses_by_category.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                                {t('reports_page.no_data')}
                            </Typography>
                        ) : (
                            <Stack spacing={1.25}>
                                {pnl.operating_expenses_by_category.map((row) => {
                                    const max = pnl.operating_expenses_by_category[0]?.total || 1;
                                    return (
                                        <Box key={row.category}>
                                            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                                                <Typography variant="body2">{row.category}</Typography>
                                                <Typography variant="body2" fontWeight={600} color="error.main">
                                                    −{money(row.total)}
                                                </Typography>
                                            </Stack>
                                            <Box sx={{ height: 6, borderRadius: 3, bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                                                <Box
                                                    sx={{
                                                        height: '100%',
                                                        borderRadius: 3,
                                                        bgcolor: 'primary.main',
                                                        width: `${(row.total / max) * 100}%`,
                                                    }}
                                                />
                                            </Box>
                                        </Box>
                                    );
                                })}
                            </Stack>
                        )}
                        <Stack
                            direction="row"
                            justifyContent="space-between"
                            sx={{ mt: 1.5, pt: 1.25, borderTop: '1px solid', borderColor: 'divider' }}
                        >
                            <Typography variant="body2" fontWeight={700}>
                                {t('reports_page.total_operating_expenses')}
                            </Typography>
                            <Typography variant="body2" fontWeight={700} color="error.main">
                                −{money(pnl.operating_expenses)}
                            </Typography>
                        </Stack>
                    </Box>

                    <Stack spacing={1.25}>
                        <PnlRow label={t('fields.payroll_cost')} value={`−${money(pnl.payroll_cost)}`} muted />
                        <PnlRow
                            label={pnl.net_profit >= 0 ? t('fields.net_profit') : t('reports_page.net_loss')}
                            value={money(pnl.net_profit)}
                            bold
                            large
                            divider
                            color={pnl.net_profit >= 0 ? theme.palette.success.main : theme.palette.error.main}
                        />
                    </Stack>

                    <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 3, mb: 1.5 }}>
                        {t('reports_page.financial_position')}
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" useFlexGap sx={{ mx: -0.75 }}>
                        {[
                            { label: t('reports_page.cash_balance'), value: pnl.cash_balance },
                            { label: t('reports_page.inventory_value'), value: pnl.inventory_value },
                            { label: t('reports_page.accounts_receivable'), value: pnl.receivables_total },
                            { label: t('reports_page.accounts_payable'), value: pnl.payables_total },
                        ].map((item) => (
                            <Box key={item.label} sx={{ width: { xs: '50%', sm: '25%' }, p: 0.75 }}>
                                <Box
                                    sx={{
                                        p: 1.5,
                                        borderRadius: 2,
                                        bgcolor: alpha(theme.palette.text.primary, 0.03),
                                        height: '100%',
                                    }}
                                >
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                        {item.label}
                                    </Typography>
                                    <Typography variant="body1" fontWeight={700}>
                                        {money(item.value)}
                                    </Typography>
                                </Box>
                            </Box>
                        ))}
                    </Stack>
                </Paper>
            )}

            {!isLoading && tab === 'sales-summary' && salesRows && (
                <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                                    <TableCell>{t('reports_page.period')}</TableCell>
                                    <TableCell align="right">{t('reports_page.sale_count')}</TableCell>
                                    <TableCell align="right">{t('fields.total')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {salesRows.map((row) => (
                                    <TableRow key={row.period} hover>
                                        <TableCell>{row.period}</TableCell>
                                        <TableCell align="right">{row.sale_count}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                                            {money(row.total)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {salesRows.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3}>
                                            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                                {t('reports_page.no_data')}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            )}

            {!isLoading && tab === 'purchase-summary' && purchaseRows && (
                <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                                    <TableCell>{t('reports_page.period')}</TableCell>
                                    <TableCell align="right">{t('reports_page.purchase_count')}</TableCell>
                                    <TableCell align="right">{t('fields.total')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {purchaseRows.map((row) => (
                                    <TableRow key={row.period} hover>
                                        <TableCell>{row.period}</TableCell>
                                        <TableCell align="right">{row.purchase_count}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                                            {money(row.total)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {purchaseRows.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3}>
                                            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                                {t('reports_page.no_data')}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            )}

            {!isLoading && tab === 'expenses-by-category' && expenseRows && (
                <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                                    <TableCell>{t('fields.category')}</TableCell>
                                    <TableCell align="right">{t('fields.total')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {expenseRows.map((row) => (
                                    <TableRow key={row.category} hover>
                                        <TableCell>{row.category}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                                            {money(row.total)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {expenseRows.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={2}>
                                            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                                {t('reports_page.no_data')}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            )}

            {!isLoading && tab === 'inventory' && valuation && (
                <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                                    <TableCell>{t('fields.sku')}</TableCell>
                                    <TableCell>{t('fields.product')}</TableCell>
                                    <TableCell>{t('fields.warehouse')}</TableCell>
                                    <TableCell align="right">{t('fields.quantity')}</TableCell>
                                    <TableCell align="right">{t('fields.avg_cost')}</TableCell>
                                    <TableCell align="right">{t('fields.value')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {valuation.rows.map((row) => (
                                    <TableRow key={`${row.product_id}-${row.warehouse_id}`} hover>
                                        <TableCell>{row.sku}</TableCell>
                                        <TableCell>{row.product_name}</TableCell>
                                        <TableCell>{row.warehouse_name}</TableCell>
                                        <TableCell align="right">{row.quantity}</TableCell>
                                        <TableCell align="right">{money(row.average_cost)}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                                            {money(row.value)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {valuation.rows.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6}>
                                            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                                {t('reports_page.no_data')}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    {valuation.rows.length > 0 && (
                        <Stack direction="row" justifyContent="flex-end" sx={{ p: 2 }}>
                            <Typography variant="subtitle1" fontWeight={800}>
                                {t('fields.total')}: {money(valuation.total_value)}
                            </Typography>
                        </Stack>
                    )}
                </Paper>
            )}

            {!isLoading && tab === 'receivables' && receivables && (
                <PartyBalanceTable
                    rows={receivables.rows}
                    total={receivables.total}
                    money={money}
                    partyLabel={t('reports_page.customer')}
                    chipColor="warning"
                    noData={t('reports_page.no_data')}
                    totalLabel={t('fields.total')}
                />
            )}

            {!isLoading && tab === 'payables' && payables && (
                <PartyBalanceTable
                    rows={payables.rows}
                    total={payables.total}
                    money={money}
                    partyLabel={t('reports_page.supplier')}
                    chipColor="error"
                    noData={t('reports_page.no_data')}
                    totalLabel={t('fields.total')}
                />
            )}

            {!isLoading && tab === 'cash' && cashAccountId === '' && (
                <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}>
                    <Typography color="text.secondary">{t('reports_page.no_cash_accounts')}</Typography>
                </Paper>
            )}

            {!isLoading && tab === 'cash' && cashAccountId !== '' && cashLedger && (
                <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                    <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ p: 2, bgcolor: alpha(theme.palette.success.main, 0.06) }}
                    >
                        <Typography variant="body2" color="text.secondary">
                            {t('reports_page.current_balance')}
                        </Typography>
                        <Typography variant="h6" fontWeight={800} color="success.dark">
                            {money(cashLedger.current_balance)}
                        </Typography>
                    </Stack>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                                    <TableCell>{t('fields.date')}</TableCell>
                                    <TableCell>{t('fields.description')}</TableCell>
                                    <TableCell align="right">{t('reports_page.cash_in')}</TableCell>
                                    <TableCell align="right">{t('reports_page.cash_out')}</TableCell>
                                    <TableCell align="right">{t('fields.balance')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {cashLedger.data.map((entry) => (
                                    <TableRow key={entry.id} hover>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                            {formatDate(entry.transaction_date, i18n.language)}
                                        </TableCell>
                                        <TableCell>{entry.description ?? '—'}</TableCell>
                                        <TableCell align="right">
                                            {entry.entry_type === 'debit' ? (
                                                <Typography variant="body2" fontWeight={700} color="success.main">
                                                    +{entry.amount.toFixed(2)}
                                                </Typography>
                                            ) : (
                                                <Typography variant="body2" color="text.disabled">
                                                    —
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell align="right">
                                            {entry.entry_type === 'credit' ? (
                                                <Typography variant="body2" fontWeight={700} color="error.main">
                                                    −{entry.amount.toFixed(2)}
                                                </Typography>
                                            ) : (
                                                <Typography variant="body2" color="text.disabled">
                                                    —
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                                            {entry.running_balance.toFixed(2)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {cashLedger.data.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5}>
                                            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                                {t('reports_page.no_data')}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <TablePagination
                        component="div"
                        count={cashLedger.meta.total}
                        page={cashPage}
                        onPageChange={(_, newPage) => setCashPage(newPage)}
                        rowsPerPage={cashPerPage}
                        rowsPerPageOptions={[cashPerPage]}
                        onRowsPerPageChange={() => {}}
                    />
                </Paper>
            )}
        </Box>
    );
}

function PnlRow({
    label,
    value,
    bold,
    large,
    muted,
    divider,
    color,
}: {
    label: string;
    value: string;
    bold?: boolean;
    large?: boolean;
    muted?: boolean;
    divider?: boolean;
    color?: string;
}) {
    return (
        <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={divider ? { pt: 1.25, borderTop: '1px solid', borderColor: 'divider' } : undefined}
        >
            <Typography variant={large ? 'body1' : 'body2'} color={muted ? 'text.secondary' : 'text.primary'} fontWeight={bold ? 700 : 400}>
                {label}
            </Typography>
            <Typography
                variant={large ? 'h5' : 'body2'}
                fontWeight={bold ? 800 : 500}
                sx={{ color: color ?? (muted ? 'text.secondary' : 'text.primary') }}
            >
                {value}
            </Typography>
        </Stack>
    );
}

function PartyBalanceTable({
    rows,
    total,
    money,
    partyLabel,
    chipColor,
    noData,
    totalLabel,
}: {
    rows: { id: number; name: string; phone: string | null; balance: number }[];
    total: number;
    money: (v: number) => string;
    partyLabel: string;
    chipColor: 'warning' | 'error';
    noData: string;
    totalLabel: string;
}) {
    const { t } = useTranslation();
    return (
        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <TableContainer>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                            <TableCell>{partyLabel}</TableCell>
                            <TableCell>{t('fields.phone')}</TableCell>
                            <TableCell align="right">{t('fields.balance')}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows.map((row) => (
                            <TableRow key={row.id} hover>
                                <TableCell sx={{ fontWeight: 600 }}>{row.name}</TableCell>
                                <TableCell>{row.phone ?? '—'}</TableCell>
                                <TableCell align="right">
                                    <Chip size="small" color={chipColor} label={money(row.balance)} />
                                </TableCell>
                            </TableRow>
                        ))}
                        {rows.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={3}>
                                    <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                        {noData}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
            {rows.length > 0 && (
                <Stack direction="row" justifyContent="flex-end" sx={{ p: 2 }}>
                    <Typography variant="subtitle1" fontWeight={800}>
                        {totalLabel}: {money(total)}
                    </Typography>
                </Stack>
            )}
        </Paper>
    );
}
