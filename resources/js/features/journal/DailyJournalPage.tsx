import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Avatar,
    Box,
    Chip,
    IconButton,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import TodayIcon from '@mui/icons-material/Today';
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { useTranslation } from 'react-i18next';
import { BrandSpinner } from '@/components/BrandSpinner';
import { DualDateField } from '@/components/DualDateField';
import { ReportActions } from '@/components/ReportActions';
import {
    fetchDailyJournal,
    downloadDailyJournalPdf,
    type DailyJournalTransaction,
} from '@/features/reports/api';
import { fetchBusinessSettings } from '@/features/settings/api';

function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
}

function shiftDate(iso: string, days: number): string {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

const TYPE_ICON: Record<DailyJournalTransaction['type'], ReactNode> = {
    sale: <PointOfSaleOutlinedIcon fontSize="small" />,
    purchase: <ShoppingCartOutlinedIcon fontSize="small" />,
    customer_collection: <CreditCardOutlinedIcon fontSize="small" />,
    supplier_payment: <LocalShippingOutlinedIcon fontSize="small" />,
    expense: <ReceiptLongOutlinedIcon fontSize="small" />,
};

type Tone = 'primary' | 'secondary' | 'success' | 'warning' | 'error';

export function DailyJournalPage() {
    const { t, i18n } = useTranslation();
    const theme = useTheme();
    const [date, setDate] = useState(todayIso());

    const { data: settings } = useQuery({ queryKey: ['business-settings'], queryFn: fetchBusinessSettings });
    const sym = settings?.currency_symbol ?? '';
    const companyName = settings?.company_name ?? '';
    const money = (v: number) =>
        `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${sym ? ` ${sym}` : ''}`;

    const { data: journal, isFetching } = useQuery({
        queryKey: ['daily-journal', date],
        queryFn: () => fetchDailyJournal(date),
    });

    const waMessage = journal
        ? t('journal_page.wa_message', {
              company: companyName,
              date,
              result: money(journal.profit_or_loss),
          })
        : undefined;

    const summaryCards: { key: string; label: string; value: number; icon: ReactNode; tone: Tone }[] = journal
        ? [
              { key: 'sales', label: t('journal_page.daily_sales'), value: journal.sales_total, icon: <PointOfSaleOutlinedIcon fontSize="small" />, tone: 'primary' },
              { key: 'credit_sales', label: t('journal_page.credit_sales'), value: journal.credit_sales_total, icon: <CreditCardOutlinedIcon fontSize="small" />, tone: 'warning' },
              { key: 'collections', label: t('journal_page.customer_collections'), value: journal.customer_collections_total, icon: <SavingsOutlinedIcon fontSize="small" />, tone: 'success' },
              { key: 'purchases', label: t('journal_page.purchases'), value: journal.purchases_total, icon: <ShoppingCartOutlinedIcon fontSize="small" />, tone: 'secondary' },
              { key: 'supplier_payments', label: t('journal_page.supplier_payments'), value: journal.supplier_payments_total, icon: <LocalShippingOutlinedIcon fontSize="small" />, tone: 'error' },
              { key: 'expenses', label: t('journal_page.expenses'), value: journal.expenses_total, icon: <ReceiptLongOutlinedIcon fontSize="small" />, tone: 'error' },
          ]
        : [];

    return (
        <Box>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" fontWeight={800}>
                    {t('journal_page.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {t('journal_page.subtitle')}
                </Typography>
            </Box>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 2.5 }}>
                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Tooltip title={t('journal_page.previous_day')}>
                        <IconButton onClick={() => setDate((d) => shiftDate(d, -1))}>
                            <ArrowBackIosNewIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <DualDateField label={t('fields.date')} value={date} onChange={setDate} />
                    <Tooltip title={t('journal_page.next_day')}>
                        <span>
                            <IconButton onClick={() => setDate((d) => shiftDate(d, 1))} disabled={date >= todayIso()}>
                                <ArrowForwardIosIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title={t('journal_page.jump_to_today')}>
                        <IconButton onClick={() => setDate(todayIso())} disabled={date === todayIso()}>
                            <TodayIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Box sx={{ flexGrow: 1 }} />
                    <ReportActions download={() => downloadDailyJournalPdf(date)} message={waMessage} />
                </Stack>
            </Paper>

            {isFetching && <BrandSpinner fullPage minHeight={240} label={t('common.loading')} />}

            {!isFetching && journal && (
                <>
                    <Stack direction="row" flexWrap="wrap" useFlexGap sx={{ mx: -1, mb: 2.5 }}>
                        {summaryCards.map((card) => (
                            <Box key={card.key} sx={{ width: { xs: '50%', sm: '33.33%', md: '16.66%' }, p: 1 }}>
                                <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, height: '100%' }}>
                                    <Avatar
                                        variant="rounded"
                                        sx={{
                                            width: 32,
                                            height: 32,
                                            bgcolor: alpha(theme.palette[card.tone].main, 0.12),
                                            color: `${card.tone}.dark`,
                                            mb: 1,
                                        }}
                                    >
                                        {card.icon}
                                    </Avatar>
                                    <Typography variant="body1" fontWeight={800}>
                                        {money(card.value)}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {card.label}
                                    </Typography>
                                </Paper>
                            </Box>
                        ))}
                    </Stack>

                    <Stack direction="row" flexWrap="wrap" useFlexGap sx={{ mx: -1, mb: 2.5 }}>
                        <Box sx={{ width: { xs: '100%', sm: '50%' }, p: 1 }}>
                            <Paper
                                variant="outlined"
                                sx={{ p: 2.5, borderRadius: 3, bgcolor: alpha(theme.palette.text.primary, 0.03), height: '100%' }}
                            >
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Box>
                                        <Typography variant="body2" color="text.secondary">
                                            {t('journal_page.net_cash_movement')}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {t('journal_page.cash_in')}: {money(journal.cash_in_total)} •{' '}
                                            {t('journal_page.cash_out')}: {money(journal.cash_out_total)}
                                        </Typography>
                                    </Box>
                                    <Typography
                                        variant="h5"
                                        fontWeight={800}
                                        color={journal.net_cash_movement >= 0 ? 'success.main' : 'error.main'}
                                    >
                                        {money(journal.net_cash_movement)}
                                    </Typography>
                                </Stack>
                            </Paper>
                        </Box>
                        <Box sx={{ width: { xs: '100%', sm: '50%' }, p: 1 }}>
                            <Paper
                                variant="outlined"
                                sx={{
                                    p: 2.5,
                                    borderRadius: 3,
                                    height: '100%',
                                    bgcolor: alpha(
                                        journal.profit_or_loss >= 0 ? theme.palette.success.main : theme.palette.error.main,
                                        0.06,
                                    ),
                                }}
                            >
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Typography variant="body2" color="text.secondary">
                                        {journal.profit_or_loss >= 0
                                            ? t('journal_page.profit_today')
                                            : t('journal_page.loss_today')}
                                    </Typography>
                                    <Typography
                                        variant="h5"
                                        fontWeight={800}
                                        color={journal.profit_or_loss >= 0 ? 'success.dark' : 'error.dark'}
                                    >
                                        {money(journal.profit_or_loss)}
                                    </Typography>
                                </Stack>
                            </Paper>
                        </Box>
                    </Stack>

                    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="subtitle1" fontWeight={700}>
                                {t('journal_page.transactions')}
                            </Typography>
                        </Box>
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                                        <TableCell>{t('fields.date')}</TableCell>
                                        <TableCell />
                                        <TableCell>{t('fields.description')}</TableCell>
                                        <TableCell align="right">{t('fields.amount')}</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {journal.transactions.map((tx, index) => (
                                        <TableRow key={`${tx.type}-${index}`} hover>
                                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                                {new Date(tx.time).toLocaleTimeString(i18n.language, {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </TableCell>
                                            <TableCell sx={{ width: 44 }}>
                                                <Avatar
                                                    variant="rounded"
                                                    sx={{
                                                        width: 28,
                                                        height: 28,
                                                        bgcolor: alpha(
                                                            tx.direction === 'in'
                                                                ? theme.palette.success.main
                                                                : theme.palette.error.main,
                                                            0.12,
                                                        ),
                                                        color: tx.direction === 'in' ? 'success.dark' : 'error.dark',
                                                    }}
                                                >
                                                    {TYPE_ICON[tx.type]}
                                                </Avatar>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">{tx.description}</Typography>
                                                <Chip
                                                    size="small"
                                                    variant="outlined"
                                                    label={t(`journal_page.type_${tx.type}`)}
                                                    sx={{ height: 18, fontSize: 10, mt: 0.5 }}
                                                />
                                            </TableCell>
                                            <TableCell align="right">
                                                <Typography
                                                    variant="body2"
                                                    fontWeight={700}
                                                    color={tx.direction === 'in' ? 'success.main' : 'error.main'}
                                                >
                                                    {tx.direction === 'in' ? '+' : '−'}
                                                    {tx.amount.toFixed(2)}
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {journal.transactions.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4}>
                                                <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                                    {t('journal_page.no_transactions')}
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                </>
            )}
        </Box>
    );
}
