import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { useNavigate } from 'react-router-dom';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import { useTranslation } from 'react-i18next';
import { fetchPayrollRuns, createPayrollRun } from '@/features/payroll/api';

export function PayrollPage() {
    const { t } = useTranslation();
    const months = t('months', { returnObjects: true }) as string[];
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { data: runs, isLoading } = useQuery({ queryKey: ['payroll-runs'], queryFn: fetchPayrollRuns });

    const now = new Date();
    const [newOpen, setNewOpen] = useState(false);
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [error, setError] = useState<string | null>(null);

    const createMutation = useMutation({
        mutationFn: () => createPayrollRun(month, year),
        onSuccess: (run) => {
            queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
            setNewOpen(false);
            setError(null);
            navigate(`/payroll/${run.id}`);
        },
        onError: () => setError(t('payroll_page.run_exists')),
    });

    return (
        <Box>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={2} sx={{ mb: 3 }}>
                <Box>
                    <Typography variant="h4" fontWeight={800}>
                        {t('nav.payroll')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {t('payroll_page.subtitle')}
                    </Typography>
                </Box>
                <Button variant="contained" size="large" onClick={() => setNewOpen(true)}>
                    {t('payroll_page.new_run')}
                </Button>
            </Stack>

            <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                                <TableCell>{t('fields.period')}</TableCell>
                                <TableCell>{t('fields.status')}</TableCell>
                                <TableCell align="right">{t('fields.total_net_pay')}</TableCell>
                                <TableCell align="right"> </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={4}>
                                        <Box sx={{ py: 4, textAlign: 'center' }}>
                                            <CircularProgress size={28} />
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            )}
                            {runs?.map((run) => (
                                <TableRow
                                    key={run.id}
                                    hover
                                    sx={{ cursor: 'pointer' }}
                                    onClick={() => navigate(`/payroll/${run.id}`)}
                                >
                                    <TableCell sx={{ fontWeight: 600 }}>
                                        {months[run.period_month - 1]} {run.period_year}
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            size="small"
                                            color={run.status === 'paid' ? 'success' : 'default'}
                                            variant={run.status === 'paid' ? 'filled' : 'outlined'}
                                            label={t(`status.${run.status}`)}
                                        />
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                                        {run.total_net_pay.toFixed(2)}
                                    </TableCell>
                                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                                        <Tooltip title={t('actions.view')}>
                                            <IconButton
                                                size="small"
                                                color="primary"
                                                onClick={() => navigate(`/payroll/${run.id}`)}
                                            >
                                                <VisibilityOutlinedIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {runs && runs.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4}>
                                        <Box sx={{ py: 6, textAlign: 'center' }}>
                                            <PaymentsOutlinedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                                            <Typography color="text.secondary">
                                                {t('payroll_page.no_runs')}
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
                <DialogTitle>{t('payroll_page.new_run')}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        {error && <Alert severity="error">{error}</Alert>}
                        <TextField
                            select
                            label={t('fields.month')}
                            value={month}
                            onChange={(e) => setMonth(Number(e.target.value))}
                            fullWidth
                        >
                            {months.map((m, i) => (
                                <MenuItem key={m} value={i + 1}>
                                    {m}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            label={t('fields.year')}
                            type="number"
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                            fullWidth
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setNewOpen(false)}>{t('actions.cancel')}</Button>
                    <Button variant="contained" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
                        {t('actions.save')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
