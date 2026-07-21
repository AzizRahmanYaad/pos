import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Alert,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
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
import { fetchPeriodClosings, fetchPeriodClosing, closePeriod, reopenPeriod, type PeriodClosingDto } from '@/features/period-closing/api';
import { Can } from '@/components/Can';
import { DualDateField } from '@/components/DualDateField';
import { formatDate } from '@/lib/calendar';

export function PeriodClosingPage() {
    const { t, i18n } = useTranslation();
    const queryClient = useQueryClient();
    const { data: closings } = useQuery({ queryKey: ['period-closings'], queryFn: fetchPeriodClosings });

    const [newOpen, setNewOpen] = useState(false);
    const [periodType, setPeriodType] = useState<'daily' | 'monthly' | 'custom'>('daily');
    const [periodStart, setPeriodStart] = useState('');
    const [periodEnd, setPeriodEnd] = useState('');
    const [expanded, setExpanded] = useState<PeriodClosingDto | null>(null);
    const [error, setError] = useState<string | null>(null);

    const closeMutation = useMutation({
        mutationFn: closePeriod,
        onSuccess: (closing) => {
            queryClient.invalidateQueries({ queryKey: ['period-closings'] });
            setNewOpen(false);
            setPeriodStart('');
            setPeriodEnd('');
            setExpanded(closing);
            setError(null);
        },
        onError: () => setError(t('period_closing_page.close_failed')),
    });

    const reopenMutation = useMutation({
        mutationFn: reopenPeriod,
        onSuccess: (closing) => {
            queryClient.invalidateQueries({ queryKey: ['period-closings'] });
            setExpanded(closing);
        },
    });

    const viewClosing = async (id: number) => {
        const full = await fetchPeriodClosing(id);
        setExpanded(full);
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4">{t('nav.period_closing')}</Typography>
                <Button variant="contained" onClick={() => setNewOpen(true)}>
                    {t('period_closing_page.close_a_period')}
                </Button>
            </Box>

            {closings && (
                <TableContainer component={Paper} sx={{ mb: 3 }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('fields.type')}</TableCell>
                                <TableCell>{t('fields.from')}</TableCell>
                                <TableCell>{t('fields.to')}</TableCell>
                                <TableCell>{t('fields.status')}</TableCell>
                                <TableCell align="right"> </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {closings.map((closing) => (
                                <TableRow key={closing.id}>
                                    <TableCell>{t(`period_closing_page.${closing.period_type}`)}</TableCell>
                                    <TableCell>{formatDate(closing.period_start, i18n.language)}</TableCell>
                                    <TableCell>{formatDate(closing.period_end, i18n.language)}</TableCell>
                                    <TableCell>
                                        <Chip
                                            size="small"
                                            color={closing.status === 'closed' ? 'success' : 'default'}
                                            label={t(`status.${closing.status}`)}
                                        />
                                    </TableCell>
                                    <TableCell align="right">
                                        <Button size="small" onClick={() => viewClosing(closing.id)}>
                                            {t('actions.view')}
                                        </Button>
                                        {closing.status === 'closed' && (
                                            <Can permission="period-closing.reopen">
                                                <Button
                                                    size="small"
                                                    color="warning"
                                                    onClick={() => reopenMutation.mutate(closing.id)}
                                                >
                                                    {t('period_closing_page.reopen')}
                                                </Button>
                                            </Can>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {expanded && (
                <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                        <Box component="span" dir="ltr" sx={{ display: 'inline-block' }}>
                            {formatDate(expanded.period_start, i18n.language)} — {formatDate(expanded.period_end, i18n.language)}
                        </Box>{' '}
                        ({t(`status.${expanded.status}`)})
                    </Typography>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('fields.type')}</TableCell>
                                <TableCell>{t('period_closing_page.reference')}</TableCell>
                                <TableCell align="right">{t('fields.amount')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {(expanded.snapshots ?? []).map((snap) => (
                                <TableRow key={snap.id}>
                                    <TableCell>{snap.snapshot_type}</TableCell>
                                    <TableCell>{snap.reference_label ?? t('common.none')}</TableCell>
                                    <TableCell align="right">{snap.amount.toFixed(2)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Paper>
            )}

            <Dialog open={newOpen} onClose={() => setNewOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>{t('period_closing_page.close_a_period')}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        {error && <Alert severity="error">{error}</Alert>}
                        <TextField
                            select
                            label={t('fields.type')}
                            value={periodType}
                            onChange={(e) => setPeriodType(e.target.value as typeof periodType)}
                            fullWidth
                        >
                            <MenuItem value="daily">{t('period_closing_page.daily')}</MenuItem>
                            <MenuItem value="monthly">{t('period_closing_page.monthly')}</MenuItem>
                            <MenuItem value="custom">{t('period_closing_page.custom')}</MenuItem>
                        </TextField>
                        <DualDateField label={t('fields.from')} value={periodStart} onChange={setPeriodStart} fullWidth />
                        <DualDateField label={t('fields.to')} value={periodEnd} onChange={setPeriodEnd} fullWidth />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setNewOpen(false)}>{t('actions.cancel')}</Button>
                    <Button
                        variant="contained"
                        disabled={!periodStart || !periodEnd || closeMutation.isPending}
                        onClick={() =>
                            closeMutation.mutate({ period_type: periodType, period_start: periodStart, period_end: periodEnd })
                        }
                    >
                        {t('actions.save')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
