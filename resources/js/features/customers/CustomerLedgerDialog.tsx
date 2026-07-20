import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
    Avatar,
    Box,
    Chip,
    CircularProgress,
    Dialog,
    DialogContent,
    DialogTitle,
    IconButton,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    Tooltip,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { useTranslation } from 'react-i18next';
import { fetchCustomerLedger, type CustomerListItem } from '@/features/customers/api';
import { formatDate } from '@/lib/calendar';

interface CustomerLedgerDialogProps {
    customer: CustomerListItem;
    open: boolean;
    onClose: () => void;
}

/** "App\Models\Sale" → "sale" */
function sourceKey(sourceType: string | null): string {
    if (!sourceType) return 'manual';
    return sourceType.split('\\').pop()!.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
}

export function CustomerLedgerDialog({ customer, open, onClose }: CustomerLedgerDialogProps) {
    const { t, i18n } = useTranslation();
    const theme = useTheme();
    const [page, setPage] = useState(0);

    const { data, isLoading } = useQuery({
        queryKey: ['customer-ledger', customer.id, page],
        queryFn: () => fetchCustomerLedger(customer.id, page + 1),
        enabled: open,
        placeholderData: keepPreviousData,
    });

    const balance = data?.current_balance ?? customer.current_balance;

    const balanceChip =
        balance > 0 ? (
            <Chip
                color="error"
                icon={<ArrowUpwardIcon />}
                label={t('ledger.owes_you', { amount: balance.toFixed(2) })}
                sx={{ fontWeight: 700 }}
            />
        ) : balance < 0 ? (
            <Chip
                color="success"
                icon={<ArrowDownwardIcon />}
                label={t('ledger.advance_from', { amount: Math.abs(balance).toFixed(2) })}
                sx={{ fontWeight: 700 }}
            />
        ) : (
            <Chip label={t('ledger.settled')} sx={{ fontWeight: 700 }} />
        );

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle sx={{ pb: 1.5 }}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.9) }}>
                        <MenuBookOutlinedIcon />
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="h6" fontWeight={700} noWrap>
                            {t('ledger.title', { name: customer.name })}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {customer.phone ?? '—'}
                        </Typography>
                    </Box>
                    {balanceChip}
                    <IconButton onClick={onClose} size="small">
                        <CloseIcon />
                    </IconButton>
                </Stack>
            </DialogTitle>

            <DialogContent sx={{ pt: 0 }}>
                {/* Legend so anyone can read the ledger at a glance */}
                <Stack direction="row" spacing={2} sx={{ mb: 1.5 }} flexWrap="wrap">
                    <Stack direction="row" spacing={0.5} alignItems="center">
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'error.main' }} />
                        <Typography variant="caption" color="text.secondary">
                            {t('ledger.debit_hint')}
                        </Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'success.main' }} />
                        <Typography variant="caption" color="text.secondary">
                            {t('ledger.credit_hint')}
                        </Typography>
                    </Stack>
                </Stack>

                <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                    <TableContainer sx={{ maxHeight: 420 }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                                    <TableCell>{t('fields.date')}</TableCell>
                                    <TableCell>{t('fields.description')}</TableCell>
                                    <TableCell align="right">{t('ledger.debit')}</TableCell>
                                    <TableCell align="right">{t('ledger.credit')}</TableCell>
                                    <TableCell align="right">{t('fields.balance')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {isLoading && (
                                    <TableRow>
                                        <TableCell colSpan={5}>
                                            <Box sx={{ py: 4, textAlign: 'center' }}>
                                                <CircularProgress size={26} />
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                )}
                                {data?.data.map((entry) => (
                                    <TableRow key={entry.id} hover>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                            {formatDate(entry.transaction_date, i18n.language)}
                                        </TableCell>
                                        <TableCell>
                                            <Stack
                                                direction="row"
                                                spacing={1}
                                                alignItems="center"
                                                flexWrap="wrap"
                                            >
                                                {entry.source_type && (
                                                    <Chip
                                                        size="small"
                                                        variant="outlined"
                                                        label={t(
                                                            `ledger.source_${sourceKey(entry.source_type)}`,
                                                            { defaultValue: sourceKey(entry.source_type) },
                                                        )}
                                                        sx={{ height: 20, fontSize: 11 }}
                                                    />
                                                )}
                                                <Typography variant="body2">
                                                    {entry.description ?? '—'}
                                                </Typography>
                                            </Stack>
                                            {entry.created_by && (
                                                <Typography variant="caption" color="text.secondary">
                                                    {entry.created_by}
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell align="right">
                                            {entry.entry_type === 'debit' ? (
                                                <Typography
                                                    variant="body2"
                                                    fontWeight={700}
                                                    color="error.main"
                                                >
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
                                                <Typography
                                                    variant="body2"
                                                    fontWeight={700}
                                                    color="success.main"
                                                >
                                                    −{entry.amount.toFixed(2)}
                                                </Typography>
                                            ) : (
                                                <Typography variant="body2" color="text.disabled">
                                                    —
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell align="right">
                                            <Tooltip
                                                title={
                                                    entry.running_balance > 0
                                                        ? t('ledger.owes_you', {
                                                              amount: entry.running_balance.toFixed(2),
                                                          })
                                                        : t('ledger.settled')
                                                }
                                            >
                                                <Typography
                                                    variant="body2"
                                                    fontWeight={700}
                                                    color={
                                                        entry.running_balance > 0
                                                            ? 'error.main'
                                                            : entry.running_balance < 0
                                                              ? 'success.main'
                                                              : 'text.primary'
                                                    }
                                                >
                                                    {entry.running_balance.toFixed(2)}
                                                </Typography>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {data && data.data.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5}>
                                            <Box sx={{ py: 5, textAlign: 'center' }}>
                                                <MenuBookOutlinedIcon
                                                    sx={{ fontSize: 38, color: 'text.disabled', mb: 1 }}
                                                />
                                                <Typography color="text.secondary">
                                                    {t('ledger.no_entries')}
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
                        rowsPerPage={data?.meta.per_page ?? 15}
                        rowsPerPageOptions={[]}
                    />
                </Paper>
            </DialogContent>
        </Dialog>
    );
}
