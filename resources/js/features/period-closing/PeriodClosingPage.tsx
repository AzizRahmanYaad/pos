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

function formatDate(value: string): string {
    return value.slice(0, 10);
}

export function PeriodClosingPage() {
    const { t } = useTranslation();
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
        onError: () => setError('Could not close period — check the dates do not overlap an already closed period.'),
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
                    Close a period
                </Button>
            </Box>

            {closings && (
                <TableContainer component={Paper} sx={{ mb: 3 }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Type</TableCell>
                                <TableCell>From</TableCell>
                                <TableCell>To</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell align="right"> </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {closings.map((closing) => (
                                <TableRow key={closing.id}>
                                    <TableCell>{closing.period_type}</TableCell>
                                    <TableCell>{formatDate(closing.period_start)}</TableCell>
                                    <TableCell>{formatDate(closing.period_end)}</TableCell>
                                    <TableCell>
                                        <Chip
                                            size="small"
                                            color={closing.status === 'closed' ? 'success' : 'default'}
                                            label={closing.status}
                                        />
                                    </TableCell>
                                    <TableCell align="right">
                                        <Button size="small" onClick={() => viewClosing(closing.id)}>
                                            View
                                        </Button>
                                        {closing.status === 'closed' && (
                                            <Can permission="period-closing.reopen">
                                                <Button
                                                    size="small"
                                                    color="warning"
                                                    onClick={() => reopenMutation.mutate(closing.id)}
                                                >
                                                    Reopen
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
                        {formatDate(expanded.period_start)} — {formatDate(expanded.period_end)} ({expanded.status})
                    </Typography>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Type</TableCell>
                                <TableCell>Reference</TableCell>
                                <TableCell align="right">Amount</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {(expanded.snapshots ?? []).map((snap) => (
                                <TableRow key={snap.id}>
                                    <TableCell>{snap.snapshot_type}</TableCell>
                                    <TableCell>{snap.reference_label ?? '—'}</TableCell>
                                    <TableCell align="right">{snap.amount.toFixed(2)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Paper>
            )}

            <Dialog open={newOpen} onClose={() => setNewOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>Close a period</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        {error && <Alert severity="error">{error}</Alert>}
                        <TextField
                            select
                            label="Type"
                            value={periodType}
                            onChange={(e) => setPeriodType(e.target.value as typeof periodType)}
                            fullWidth
                        >
                            <MenuItem value="daily">Daily</MenuItem>
                            <MenuItem value="monthly">Monthly</MenuItem>
                            <MenuItem value="custom">Custom</MenuItem>
                        </TextField>
                        <TextField
                            label="From"
                            type="date"
                            value={periodStart}
                            onChange={(e) => setPeriodStart(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            fullWidth
                        />
                        <TextField
                            label="To"
                            type="date"
                            value={periodEnd}
                            onChange={(e) => setPeriodEnd(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            fullWidth
                        />
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
