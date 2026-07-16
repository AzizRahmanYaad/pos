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
import { fetchPayrollRuns, createPayrollRun, payPayrollRun, type PayrollRunDto } from '@/features/payroll/api';
import { fetchCashAccounts } from '@/features/cash-accounts/api';

export function PayrollPage() {
    const { t } = useTranslation();
    const months = t('months', { returnObjects: true }) as string[];
    const queryClient = useQueryClient();
    const { data: runs } = useQuery({ queryKey: ['payroll-runs'], queryFn: fetchPayrollRuns });
    const { data: cashAccounts } = useQuery({ queryKey: ['cash-accounts'], queryFn: fetchCashAccounts });

    const now = new Date();
    const [newOpen, setNewOpen] = useState(false);
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [expanded, setExpanded] = useState<PayrollRunDto | null>(null);
    const [payingCashAccountId, setPayingCashAccountId] = useState<number | ''>('');
    const [error, setError] = useState<string | null>(null);

    const createMutation = useMutation({
        mutationFn: () => createPayrollRun(month, year),
        onSuccess: (run) => {
            queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
            setNewOpen(false);
            setExpanded(run);
            setError(null);
        },
        onError: () => setError(t('payroll_page.run_exists')),
    });

    const payMutation = useMutation({
        mutationFn: () => payPayrollRun(expanded!.id, payingCashAccountId as number),
        onSuccess: (run) => {
            queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
            setExpanded(run);
        },
    });

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4">{t('nav.payroll')}</Typography>
                <Button variant="contained" onClick={() => setNewOpen(true)}>
                    {t('payroll_page.new_run')}
                </Button>
            </Box>

            {runs && (
                <TableContainer component={Paper} sx={{ mb: 3 }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('fields.period')}</TableCell>
                                <TableCell>{t('fields.status')}</TableCell>
                                <TableCell align="right">{t('fields.total_net_pay')}</TableCell>
                                <TableCell align="right"> </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {runs.map((run) => (
                                <TableRow key={run.id}>
                                    <TableCell>
                                        {months[run.period_month - 1]} {run.period_year}
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            size="small"
                                            color={run.status === 'paid' ? 'success' : 'default'}
                                            label={t(`status.${run.status}`)}
                                        />
                                    </TableCell>
                                    <TableCell align="right">{run.total_net_pay.toFixed(2)}</TableCell>
                                    <TableCell align="right">
                                        <Button size="small" onClick={() => setExpanded(run)}>
                                            {t('actions.view')}
                                        </Button>
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
                        {months[expanded.period_month - 1]} {expanded.period_year} — {t(`status.${expanded.status}`)}
                    </Typography>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('nav.employees')}</TableCell>
                                <TableCell align="right">{t('fields.base_salary')}</TableCell>
                                <TableCell align="right">{t('fields.advances_deducted')}</TableCell>
                                <TableCell align="right">{t('fields.net_pay')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {expanded.items.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>{item.employee_name}</TableCell>
                                    <TableCell align="right">{item.base_salary.toFixed(2)}</TableCell>
                                    <TableCell align="right">{item.advances_deducted.toFixed(2)}</TableCell>
                                    <TableCell align="right">{item.net_pay.toFixed(2)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    {expanded.status === 'draft' && (
                        <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
                            <TextField
                                select
                                size="small"
                                label={t('fields.pay_from')}
                                value={payingCashAccountId}
                                onChange={(e) => setPayingCashAccountId(Number(e.target.value))}
                                sx={{ minWidth: 200 }}
                            >
                                {cashAccounts?.map((a) => (
                                    <MenuItem key={a.id} value={a.id}>
                                        {a.name}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <Button
                                variant="contained"
                                disabled={!payingCashAccountId || payMutation.isPending}
                                onClick={() => payMutation.mutate()}
                            >
                                {t('payroll_page.pay_run')}
                            </Button>
                        </Stack>
                    )}
                </Paper>
            )}

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
