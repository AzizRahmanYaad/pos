import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Alert,
    Avatar,
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
    TablePagination,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import { fetchPayrollRunsPage, createPayrollRun } from '@/features/payroll/api';
import { fetchEmployees } from '@/features/employees/api';
import { DualDateField } from '@/components/DualDateField';
import { formatDate } from '@/lib/calendar';
import { LoadingButton } from '@/components/LoadingButton';

function todayIso(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function PayrollPage() {
    const { t, i18n } = useTranslation();
    const theme = useTheme();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [page, setPage] = useState(0);
    const [perPage, setPerPage] = useState(10);
    const [fromFilter, setFromFilter] = useState('');
    const [toFilter, setToFilter] = useState('');
    const [employeeFilter, setEmployeeFilter] = useState<number | ''>('');
    const filters = { from: fromFilter || undefined, to: toFilter || undefined, employeeId: employeeFilter || undefined };

    const { data, isLoading } = useQuery({
        queryKey: ['payroll-runs', page, perPage, filters],
        queryFn: () => fetchPayrollRunsPage({ page: page + 1, perPage, ...filters }),
        placeholderData: keepPreviousData,
    });
    const runs = data?.data;
    const { data: employees } = useQuery({ queryKey: ['employees'], queryFn: () => fetchEmployees() });

    const hasFilters = Boolean(fromFilter || toFilter || employeeFilter);

    const resetFilters = () => {
        setFromFilter('');
        setToFilter('');
        setEmployeeFilter('');
        setPage(0);
    };

    const [newOpen, setNewOpen] = useState(false);
    const [employeeId, setEmployeeId] = useState<number | ''>('');
    const [date, setDate] = useState(todayIso());
    const [bonuses, setBonuses] = useState('');
    const [deductions, setDeductions] = useState('');
    const [error, setError] = useState<string | null>(null);

    const selectedEmployee = employees?.find((e) => e.id === employeeId);
    const estimatedNet = selectedEmployee
        ? Math.max(0, selectedEmployee.salary_amount + (Number(bonuses) || 0) - (Number(deductions) || 0))
        : null;

    const createMutation = useMutation({
        mutationFn: () => createPayrollRun(employeeId as number, date, Number(bonuses) || 0, Number(deductions) || 0),
        onSuccess: (run) => {
            queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
            setNewOpen(false);
            setError(null);
            setBonuses('');
            setDeductions('');
            navigate(`/payroll/${run.id}`);
        },
        onError: () => setError(t('payroll_page.run_exists')),
    });

    /** Shows the run period in both the Gregorian and Hijri Shamsi calendars. */
    const periodLabel = (run: { period_date: string | null }) => {
        if (!run.period_date) return '—';
        const greg = formatDate(run.period_date, 'en');
        const jalali = formatDate(run.period_date, 'prs');
        return { greg, jalali };
    };

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

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 2 }}>
                <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1.5}
                    alignItems={{ md: 'flex-start' }}
                    flexWrap="wrap"
                    useFlexGap
                >
                    <TextField
                        select
                        size="small"
                        label={t('nav.employees')}
                        value={employeeFilter}
                        onChange={(e) => {
                            setEmployeeFilter(e.target.value === '' ? '' : Number(e.target.value));
                            setPage(0);
                        }}
                        sx={{ minWidth: 200 }}
                    >
                        <MenuItem value="">{t('payroll_page.all_employees')}</MenuItem>
                        {employees?.map((emp) => (
                            <MenuItem key={emp.id} value={emp.id}>
                                {emp.name}
                            </MenuItem>
                        ))}
                    </TextField>
                    <DualDateField
                        label={t('fields.from')}
                        value={fromFilter}
                        onChange={(v) => {
                            setFromFilter(v);
                            setPage(0);
                        }}
                    />
                    <DualDateField
                        label={t('fields.to')}
                        value={toFilter}
                        onChange={(v) => {
                            setToFilter(v);
                            setPage(0);
                        }}
                    />
                    {hasFilters && (
                        <Button size="small" color="inherit" onClick={resetFilters}>
                            {t('expenses_page.clear_dates')}
                        </Button>
                    )}
                </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                                <TableCell>{t('nav.employees')}</TableCell>
                                <TableCell>{t('fields.period')}</TableCell>
                                <TableCell>{t('fields.status')}</TableCell>
                                <TableCell align="right">{t('fields.net_pay')}</TableCell>
                                <TableCell align="right"> </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={5}>
                                        <Box sx={{ py: 4, textAlign: 'center' }}>
                                            <CircularProgress size={28} />
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            )}
                            {runs?.map((run) => {
                                const period = periodLabel(run);
                                return (
                                    <TableRow
                                        key={run.id}
                                        hover
                                        sx={{ cursor: 'pointer' }}
                                        onClick={() => navigate(`/payroll/${run.id}`)}
                                    >
                                        <TableCell>
                                            <Stack direction="row" alignItems="center" spacing={1.5}>
                                                <Avatar
                                                    sx={{
                                                        width: 32,
                                                        height: 32,
                                                        fontSize: 13,
                                                        bgcolor: alpha(theme.palette.primary.main, 0.15),
                                                        color: 'primary.dark',
                                                    }}
                                                >
                                                    {(run.employee_name ?? '#').charAt(0).toUpperCase()}
                                                </Avatar>
                                                <Typography variant="body2" fontWeight={600}>
                                                    {run.employee_name ?? t('payroll_page.all_employees')}
                                                </Typography>
                                            </Stack>
                                        </TableCell>
                                        <TableCell>
                                            {typeof period === 'string' ? (
                                                period
                                            ) : (
                                                <Box>
                                                    <Typography variant="body2">{period.greg}</Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {period.jalali} {t('calendar.hijri_shamsi')}
                                                    </Typography>
                                                </Box>
                                            )}
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
                                );
                            })}
                            {runs && runs.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5}>
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

                <TablePagination
                    component="div"
                    count={data?.meta.total ?? 0}
                    page={page}
                    onPageChange={(_, newPage) => setPage(newPage)}
                    rowsPerPage={perPage}
                    onRowsPerPageChange={(e) => {
                        setPerPage(Number(e.target.value));
                        setPage(0);
                    }}
                    rowsPerPageOptions={[10, 20, 50]}
                />
            </Paper>

            <Dialog open={newOpen} onClose={() => setNewOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>{t('payroll_page.new_run')}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        {error && <Alert severity="error">{error}</Alert>}
                        <TextField
                            select
                            label={t('nav.employees')}
                            value={employeeId}
                            onChange={(e) => setEmployeeId(Number(e.target.value))}
                            fullWidth
                        >
                            {employees?.map((emp) => (
                                <MenuItem key={emp.id} value={emp.id}>
                                    {emp.name}
                                    {emp.designation ? ` — ${emp.designation}` : ''}
                                </MenuItem>
                            ))}
                        </TextField>
                        <DualDateField label={t('fields.date')} value={date} onChange={setDate} fullWidth />
                        <Stack direction="row" spacing={1.5}>
                            <TextField
                                label={t('payroll_page.bonuses')}
                                type="number"
                                value={bonuses}
                                onChange={(e) => setBonuses(e.target.value)}
                                fullWidth
                            />
                            <TextField
                                label={t('payroll_page.deductions')}
                                type="number"
                                value={deductions}
                                onChange={(e) => setDeductions(e.target.value)}
                                fullWidth
                            />
                        </Stack>
                        {estimatedNet !== null && (
                            <Box
                                sx={{
                                    p: 1.5,
                                    borderRadius: 2,
                                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }}
                            >
                                <Typography variant="body2" color="text.secondary">
                                    {t('fields.net_pay')}
                                </Typography>
                                <Typography variant="h6" fontWeight={800} color="primary.dark">
                                    {estimatedNet.toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    })}
                                </Typography>
                            </Box>
                        )}
                        <Typography variant="caption" color="text.secondary">
                            {t('payroll_page.date_hint')} {t('payroll_page.advances_note')}
                        </Typography>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setNewOpen(false)}>{t('actions.cancel')}</Button>
                    <LoadingButton
                        variant="contained"
                        loading={createMutation.isPending}
                        disabled={!employeeId || !date}
                        onClick={() => createMutation.mutate()}
                    >
                        {t('payroll_page.execute')}
                    </LoadingButton>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
