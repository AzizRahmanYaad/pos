import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Avatar,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    IconButton,
    InputAdornment,
    Paper,
    Stack,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import CleaningServicesOutlinedIcon from '@mui/icons-material/CleaningServicesOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { useTranslation } from 'react-i18next';
import {
    clearPartyLedger,
    downloadPartyLedgerPdf,
    fetchPartyLedger,
    type PartyKind,
} from '@/features/parties/ledgerApi';
import { fetchBusinessSettings } from '@/features/settings/api';
import { Can } from '@/components/Can';
import { formatDate } from '@/lib/calendar';

export interface LedgerParty {
    id: number;
    name: string;
    phone: string | null;
    current_balance: number;
}

interface PartyLedgerDialogProps {
    kind: PartyKind;
    party: LedgerParty;
    /** React Query key of the list to refresh after clearing. */
    listQueryKey: string;
    open: boolean;
    onClose: () => void;
}

/** "App\Models\Sale" → "sale" */
function sourceKey(sourceType: string | null): string {
    if (!sourceType) return 'manual';
    return sourceType.split('\\').pop()!.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
}

/**
 * Describe a signed balance for a party. A customer's positive balance
 * means they owe the shop; a supplier's negative balance means the shop
 * owes them — so the red/green tone and wording flip by kind.
 */
function describeBalance(
    kind: PartyKind,
    balance: number,
    t: (key: string, opts?: Record<string, unknown>) => string,
): { tone: 'error' | 'success' | 'default'; label: string } {
    const amount = Math.abs(balance).toFixed(2);
    if (Math.abs(balance) < 0.005) return { tone: 'default', label: t('ledger.settled') };
    if (kind === 'customer') {
        return balance > 0
            ? { tone: 'error', label: t('ledger.owes_you', { amount }) }
            : { tone: 'success', label: t('ledger.advance_from', { amount }) };
    }
    return balance < 0
        ? { tone: 'error', label: t('ledger.you_owe', { amount }) }
        : { tone: 'success', label: t('ledger.supplier_advance', { amount }) };
}

function balanceColor(kind: PartyKind, rb: number): string {
    if (Math.abs(rb) < 0.005) return 'text.primary';
    if (kind === 'customer') return rb > 0 ? 'error.main' : 'success.main';
    return rb < 0 ? 'error.main' : 'success.main';
}

export function PartyLedgerDialog({ kind, party, listQueryKey, open, onClose }: PartyLedgerDialogProps) {
    const { t, i18n } = useTranslation();
    const theme = useTheme();
    const queryClient = useQueryClient();
    const [page, setPage] = useState(0);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [includeArchived, setIncludeArchived] = useState(false);
    const [confirmClear, setConfirmClear] = useState(false);
    const [busyPdf, setBusyPdf] = useState(false);

    useEffect(() => {
        const handle = setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(0);
        }, 300);
        return () => clearTimeout(handle);
    }, [searchInput]);

    const { data, isLoading } = useQuery({
        queryKey: [`${kind}-ledger`, party.id, page, search, from, to, includeArchived],
        queryFn: () =>
            fetchPartyLedger(kind, party.id, {
                page: page + 1,
                search: search || undefined,
                from: from || undefined,
                to: to || undefined,
                includeArchived,
            }),
        enabled: open,
        placeholderData: keepPreviousData,
    });

    const { data: settings } = useQuery({
        queryKey: ['business-settings'],
        queryFn: fetchBusinessSettings,
        enabled: open,
    });

    const clearMutation = useMutation({
        mutationFn: () => clearPartyLedger(kind, party.id),
        onSuccess: () => {
            setConfirmClear(false);
            queryClient.invalidateQueries({ queryKey: [`${kind}-ledger`, party.id] });
            queryClient.invalidateQueries({ queryKey: [listQueryKey] });
        },
    });

    const balance = data?.current_balance ?? party.current_balance;
    const canClear = Math.abs(balance) < 0.005;
    const summary = describeBalance(kind, balance, t);

    // Debit/credit meaning flips between customer and supplier.
    const debit = kind === 'customer'
        ? { color: 'error.main', sign: '+' }
        : { color: 'success.main', sign: '−' };
    const credit = kind === 'customer'
        ? { color: 'success.main', sign: '−' }
        : { color: 'error.main', sign: '+' };

    const currentFilters = {
        search: search || undefined,
        from: from || undefined,
        to: to || undefined,
        includeArchived,
    };

    const openPdf = async () => {
        setBusyPdf(true);
        try {
            const { url } = await downloadPartyLedgerPdf(kind, party.id, currentFilters);
            window.open(url, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } finally {
            setBusyPdf(false);
        }
    };

    const shareWhatsApp = async () => {
        setBusyPdf(true);
        try {
            const { url, filename, blob } = await downloadPartyLedgerPdf(kind, party.id, currentFilters);
            const message = t('ledger.wa_message', {
                company: settings?.company_name ?? '',
                name: party.name,
                summary: summary.label,
            });
            const file = new File([blob], filename, { type: 'application/pdf' });

            const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
            if (nav.canShare?.({ files: [file] })) {
                try {
                    await nav.share({ files: [file], text: message });
                    return;
                } catch {
                    /* cancelled — fall through to download + chat */
                }
            }

            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = filename;
            anchor.click();
            const phone = (party.phone ?? '').replace(/\D/g, '');
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } finally {
            setBusyPdf(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle sx={{ pb: 1.5 }}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.9) }}>
                        <MenuBookOutlinedIcon />
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="h6" fontWeight={700} noWrap>
                            {t('ledger.title', { name: party.name })}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {party.phone ?? '—'}
                        </Typography>
                    </Box>
                    <Chip color={summary.tone} label={summary.label} sx={{ fontWeight: 700 }} />
                    <IconButton onClick={onClose} size="small">
                        <CloseIcon />
                    </IconButton>
                </Stack>
            </DialogTitle>

            <DialogContent sx={{ pt: 0 }}>
                {/* Filters + actions */}
                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.5}
                    sx={{ mb: 1.5 }}
                    alignItems={{ sm: 'center' }}
                >
                    <TextField
                        size="small"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder={t('ledger.search_placeholder')}
                        sx={{ flex: 1, minWidth: 160 }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" />
                                </InputAdornment>
                            ),
                        }}
                    />
                    <TextField
                        size="small"
                        type="date"
                        label={t('fields.from')}
                        value={from}
                        onChange={(e) => {
                            setFrom(e.target.value);
                            setPage(0);
                        }}
                        InputLabelProps={{ shrink: true }}
                        sx={{ width: 160 }}
                    />
                    <TextField
                        size="small"
                        type="date"
                        label={t('fields.to')}
                        value={to}
                        onChange={(e) => {
                            setTo(e.target.value);
                            setPage(0);
                        }}
                        InputLabelProps={{ shrink: true }}
                        sx={{ width: 160 }}
                    />
                    <Tooltip title={t('ledger.download_pdf')}>
                        <span>
                            <IconButton
                                size="small"
                                color="primary"
                                aria-label={t('ledger.download_pdf')}
                                disabled={busyPdf}
                                onClick={openPdf}
                            >
                                <PictureAsPdfOutlinedIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Button
                        size="small"
                        variant="contained"
                        disabled={busyPdf}
                        startIcon={<WhatsAppIcon />}
                        onClick={shareWhatsApp}
                        sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#1da851' }, textTransform: 'none' }}
                    >
                        {t('ledger.whatsapp')}
                    </Button>
                    <Can permission="payments.manage">
                        <Tooltip title={canClear ? '' : t('ledger.clear_blocked')}>
                            <span>
                                <Button
                                    size="small"
                                    color="error"
                                    variant="outlined"
                                    startIcon={<CleaningServicesOutlinedIcon />}
                                    disabled={!canClear}
                                    onClick={() => setConfirmClear(true)}
                                >
                                    {t('ledger.clear')}
                                </Button>
                            </span>
                        </Tooltip>
                    </Can>
                </Stack>

                {/* Legend */}
                <Stack direction="row" spacing={2} sx={{ mb: 1.5 }} flexWrap="wrap">
                    <Stack direction="row" spacing={0.5} alignItems="center">
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: debit.color }} />
                        <Typography variant="caption" color="text.secondary">
                            {t(`ledger.debit_hint_${kind}`)}
                        </Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: credit.color }} />
                        <Typography variant="caption" color="text.secondary">
                            {t(`ledger.credit_hint_${kind}`)}
                        </Typography>
                    </Stack>
                    <Box sx={{ flex: 1 }} />
                    <FormControlLabel
                        control={
                            <Switch
                                size="small"
                                checked={includeArchived}
                                onChange={(e) => {
                                    setIncludeArchived(e.target.checked);
                                    setPage(0);
                                }}
                            />
                        }
                        label={
                            <Typography variant="caption" color="text.secondary">
                                {t('ledger.show_cleared')}
                            </Typography>
                        }
                    />
                </Stack>

                <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                    <TableContainer sx={{ maxHeight: 420 }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                                    <TableCell>{t('fields.date')}</TableCell>
                                    <TableCell>{t('fields.description')}</TableCell>
                                    <TableCell align="right">{t(`ledger.debit_${kind}`)}</TableCell>
                                    <TableCell align="right">{t(`ledger.credit_${kind}`)}</TableCell>
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
                                    <TableRow
                                        key={entry.id}
                                        hover
                                        sx={entry.archived_at ? { opacity: 0.55 } : undefined}
                                    >
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                            {formatDate(entry.transaction_date, i18n.language)}
                                            {entry.archived_at && (
                                                <Chip
                                                    size="small"
                                                    variant="outlined"
                                                    label={t('ledger.cleared_chip')}
                                                    sx={{ ml: 0.75, height: 18, fontSize: 10 }}
                                                />
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                                {entry.source_type && (
                                                    <Chip
                                                        size="small"
                                                        variant="outlined"
                                                        label={t(`ledger.source_${sourceKey(entry.source_type)}`, {
                                                            defaultValue: sourceKey(entry.source_type),
                                                        })}
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
                                                <Typography variant="body2" fontWeight={700} sx={{ color: debit.color }}>
                                                    {debit.sign}
                                                    {entry.amount.toFixed(2)}
                                                </Typography>
                                            ) : (
                                                <Typography variant="body2" color="text.disabled">
                                                    —
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell align="right">
                                            {entry.entry_type === 'credit' ? (
                                                <Typography variant="body2" fontWeight={700} sx={{ color: credit.color }}>
                                                    {credit.sign}
                                                    {entry.amount.toFixed(2)}
                                                </Typography>
                                            ) : (
                                                <Typography variant="body2" color="text.disabled">
                                                    —
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell align="right">
                                            <Typography
                                                variant="body2"
                                                fontWeight={700}
                                                sx={{ color: balanceColor(kind, entry.running_balance) }}
                                            >
                                                {entry.running_balance.toFixed(2)}
                                            </Typography>
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

            {/* Clear-ledger confirmation */}
            <Dialog open={confirmClear} onClose={() => setConfirmClear(false)} maxWidth="xs" fullWidth>
                <DialogTitle>{t('ledger.clear_title')}</DialogTitle>
                <DialogContent>
                    <Typography>{t('ledger.clear_confirm', { name: party.name })}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {t('ledger.clear_note')}
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmClear(false)}>{t('actions.cancel')}</Button>
                    <Button
                        variant="contained"
                        color="error"
                        startIcon={<CleaningServicesOutlinedIcon />}
                        disabled={clearMutation.isPending}
                        onClick={() => clearMutation.mutate()}
                    >
                        {t('ledger.clear')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Dialog>
    );
}
