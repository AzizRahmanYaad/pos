import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    IconButton,
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
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import LockClockOutlinedIcon from '@mui/icons-material/LockClockOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import { useTranslation } from 'react-i18next';
import { fetchPeriodClosings, closePeriod } from '@/features/period-closing/api';
import { Can } from '@/components/Can';
import { DualDateField } from '@/components/DualDateField';
import { formatDate } from '@/lib/calendar';

function StatTile({
    icon,
    label,
    value,
    color,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    color: string;
}) {
    return (
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box
                    sx={{
                        width: 42,
                        height: 42,
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: alpha(color, 0.12),
                        color,
                    }}
                >
                    {icon}
                </Box>
                <Box>
                    <Typography variant="h5" fontWeight={800}>
                        {value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {label}
                    </Typography>
                </Box>
            </Stack>
        </Paper>
    );
}

export function PeriodClosingPage() {
    const { t, i18n } = useTranslation();
    const theme = useTheme();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { data: closings, isLoading } = useQuery({ queryKey: ['period-closings'], queryFn: fetchPeriodClosings });

    const [newOpen, setNewOpen] = useState(false);
    const [periodType, setPeriodType] = useState<'daily' | 'monthly' | 'custom'>('daily');
    const [periodStart, setPeriodStart] = useState('');
    const [periodEnd, setPeriodEnd] = useState('');
    const [error, setError] = useState<string | null>(null);

    const closeMutation = useMutation({
        mutationFn: closePeriod,
        onSuccess: (closing) => {
            queryClient.invalidateQueries({ queryKey: ['period-closings'] });
            setNewOpen(false);
            setPeriodStart('');
            setPeriodEnd('');
            setError(null);
            navigate(`/period-closing/${closing.id}`);
        },
        onError: () => setError(t('period_closing_page.close_failed')),
    });

    const closedCount = closings?.filter((c) => c.status === 'closed').length ?? 0;
    const reopenedCount = closings?.filter((c) => c.status === 'reopened').length ?? 0;
    const latest = closings?.[0];

    return (
        <Box>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={2} sx={{ mb: 3 }}>
                <Box>
                    <Typography variant="h4" fontWeight={800}>
                        {t('nav.period_closing')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {t('period_closing_page.subtitle')}
                    </Typography>
                </Box>
                <Can permission="period-closing.close">
                    <Button variant="contained" size="large" onClick={() => setNewOpen(true)}>
                        {t('period_closing_page.close_a_period')}
                    </Button>
                </Can>
            </Stack>

            <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
                <Grid item xs={12} sm={6} md={4}>
                    <StatTile
                        icon={<LockClockOutlinedIcon />}
                        label={t('period_closing_page.total_closings')}
                        value={String(closings?.length ?? 0)}
                        color={theme.palette.primary.main}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <StatTile
                        icon={<LockOutlinedIcon />}
                        label={t('period_closing_page.currently_closed')}
                        value={String(closedCount)}
                        color={theme.palette.success.main}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <StatTile
                        icon={<LockOpenOutlinedIcon />}
                        label={t('period_closing_page.reopened_count')}
                        value={String(reopenedCount)}
                        color={theme.palette.warning.main}
                    />
                </Grid>
            </Grid>

            <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                                <TableCell>{t('fields.type')}</TableCell>
                                <TableCell>{t('fields.from')}</TableCell>
                                <TableCell>{t('fields.to')}</TableCell>
                                <TableCell>{t('period_closing_page.closed_by')}</TableCell>
                                <TableCell>{t('fields.status')}</TableCell>
                                <TableCell align="right"> </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={6}>
                                        <Box sx={{ py: 4, textAlign: 'center' }}>
                                            <CircularProgress size={28} />
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            )}
                            {closings?.map((closing) => (
                                <TableRow
                                    key={closing.id}
                                    hover
                                    sx={{ cursor: 'pointer' }}
                                    onClick={() => navigate(`/period-closing/${closing.id}`)}
                                >
                                    <TableCell sx={{ fontWeight: 600 }}>
                                        {t(`period_closing_page.${closing.period_type}`)}
                                    </TableCell>
                                    <TableCell>{formatDate(closing.period_start, i18n.language)}</TableCell>
                                    <TableCell>{formatDate(closing.period_end, i18n.language)}</TableCell>
                                    <TableCell>{closing.closed_by ?? '—'}</TableCell>
                                    <TableCell>
                                        <Chip
                                            size="small"
                                            color={closing.status === 'closed' ? 'success' : 'warning'}
                                            variant={closing.status === 'closed' ? 'filled' : 'outlined'}
                                            label={t(`status.${closing.status}`)}
                                        />
                                    </TableCell>
                                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                                        <Tooltip title={t('actions.view')}>
                                            <IconButton
                                                size="small"
                                                color="primary"
                                                onClick={() => navigate(`/period-closing/${closing.id}`)}
                                            >
                                                <VisibilityOutlinedIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {closings && closings.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6}>
                                        <Box sx={{ py: 6, textAlign: 'center' }}>
                                            <EventRepeatOutlinedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                                            <Typography color="text.secondary">
                                                {t('period_closing_page.no_closings')}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

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
