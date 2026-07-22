import { useEffect, useState } from 'react';
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
    InputAdornment,
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
import { LoadingButton } from '@/components/LoadingButton';
import { useNavigate } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import { useTranslation } from 'react-i18next';
import {
    fetchEmployees,
    createEmployee,
    recordEmployeeAdvance,
    type EmployeeListItem,
} from '@/features/employees/api';
import { fetchCashAccounts } from '@/features/cash-accounts/api';
import { DualDateField } from '@/components/DualDateField';

function todayIso(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function EmployeesListPage() {
    const { t } = useTranslation();
    const theme = useTheme();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    useEffect(() => {
        const handle = setTimeout(() => setSearch(searchInput.trim()), 300);
        return () => clearTimeout(handle);
    }, [searchInput]);

    const { data: employees, isLoading, isFetching } = useQuery({
        queryKey: ['employees', search],
        queryFn: () => fetchEmployees(search || undefined),
        placeholderData: keepPreviousData,
    });
    const { data: cashAccounts } = useQuery({ queryKey: ['cash-accounts'], queryFn: fetchCashAccounts });

    const [addOpen, setAddOpen] = useState(false);
    const [name, setName] = useState('');
    const [designation, setDesignation] = useState('');
    const [salaryAmount, setSalaryAmount] = useState('');
    const [hireDate, setHireDate] = useState(todayIso());

    const [advancing, setAdvancing] = useState<EmployeeListItem | null>(null);
    const [advanceAmount, setAdvanceAmount] = useState('');
    const [advanceCashAccountId, setAdvanceCashAccountId] = useState<number | ''>('');
    const [advanceReason, setAdvanceReason] = useState('');
    const [error, setError] = useState<string | null>(null);

    const createMutation = useMutation({
        mutationFn: createEmployee,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees'] });
            setAddOpen(false);
            setName('');
            setDesignation('');
            setSalaryAmount('');
        },
    });

    const advanceMutation = useMutation({
        mutationFn: () =>
            recordEmployeeAdvance(advancing!.id, {
                amount: Number(advanceAmount),
                cash_account_id: advanceCashAccountId as number,
                reason: advanceReason || undefined,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees'] });
            setAdvancing(null);
            setAdvanceAmount('');
            setAdvanceReason('');
            setError(null);
        },
        onError: () => setError(t('employees_page.advance_failed')),
    });

    return (
        <Box>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={2} sx={{ mb: 3 }}>
                <Box>
                    <Typography variant="h4" fontWeight={800}>
                        {t('nav.employees')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {t('employees_page.subtitle')}
                    </Typography>
                </Box>
                <Button variant="contained" size="large" onClick={() => setAddOpen(true)}>
                    {t('employees_page.new_employee')}
                </Button>
            </Stack>

            <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ p: 2 }}>
                    <TextField
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder={t('employees_page.search_placeholder')}
                        size="small"
                        fullWidth
                        sx={{ maxWidth: 380 }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" />
                                </InputAdornment>
                            ),
                            endAdornment: isFetching ? (
                                <InputAdornment position="end">
                                    <CircularProgress size={16} />
                                </InputAdornment>
                            ) : undefined,
                        }}
                    />
                    {employees && (
                        <Chip
                            variant="outlined"
                            size="small"
                            icon={<BadgeOutlinedIcon />}
                            label={t('employees_page.count', { count: employees.length })}
                        />
                    )}
                </Stack>

                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                                <TableCell>{t('fields.name')}</TableCell>
                                <TableCell>{t('fields.designation')}</TableCell>
                                <TableCell align="right">{t('fields.salary')}</TableCell>
                                <TableCell align="right">{t('fields.outstanding_advances')}</TableCell>
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
                            {employees?.map((employee) => (
                                <TableRow
                                    key={employee.id}
                                    hover
                                    sx={{ cursor: 'pointer' }}
                                    onClick={() => navigate(`/employees/${employee.id}`)}
                                >
                                    <TableCell>
                                        <Stack direction="row" alignItems="center" spacing={1.5}>
                                            <Avatar
                                                sx={{
                                                    width: 34,
                                                    height: 34,
                                                    fontSize: 14,
                                                    bgcolor: alpha(theme.palette.primary.main, 0.15),
                                                    color: 'primary.dark',
                                                }}
                                            >
                                                {employee.name.charAt(0).toUpperCase()}
                                            </Avatar>
                                            <Box>
                                                <Typography variant="body2" fontWeight={600}>
                                                    {employee.name}
                                                </Typography>
                                                {employee.phone && (
                                                    <Typography variant="caption" color="text.secondary">
                                                        {employee.phone}
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Stack>
                                    </TableCell>
                                    <TableCell>{employee.designation ?? '—'}</TableCell>
                                    <TableCell align="right">
                                        {employee.salary_amount.toFixed(2)} /{' '}
                                        {t(`fields.salary_type_${employee.salary_type}`)}
                                    </TableCell>
                                    <TableCell align="right">
                                        {employee.outstanding_advances > 0 ? (
                                            <Chip
                                                size="small"
                                                color="warning"
                                                label={employee.outstanding_advances.toFixed(2)}
                                            />
                                        ) : (
                                            '—'
                                        )}
                                    </TableCell>
                                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                                        <Tooltip title={t('employees_page.view')}>
                                            <IconButton
                                                size="small"
                                                color="primary"
                                                onClick={() => navigate(`/employees/${employee.id}`)}
                                            >
                                                <VisibilityOutlinedIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title={t('employees_page.give_advance')}>
                                            <IconButton size="small" onClick={() => setAdvancing(employee)}>
                                                <PaymentsOutlinedIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {employees && employees.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5}>
                                        <Box sx={{ py: 6, textAlign: 'center' }}>
                                            <BadgeOutlinedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                                            <Typography color="text.secondary">
                                                {t('employees_page.no_employees')}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>{t('employees_page.new_employee')}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField label={t('fields.name')} value={name} onChange={(e) => setName(e.target.value)} fullWidth />
                        <TextField
                            label={t('fields.designation')}
                            value={designation}
                            onChange={(e) => setDesignation(e.target.value)}
                            fullWidth
                        />
                        <TextField
                            label={t('fields.monthly_salary')}
                            type="number"
                            value={salaryAmount}
                            onChange={(e) => setSalaryAmount(e.target.value)}
                            fullWidth
                        />
                        <DualDateField
                            label={t('fields.hire_date')}
                            value={hireDate}
                            onChange={setHireDate}
                            fullWidth
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAddOpen(false)}>{t('actions.cancel')}</Button>
                    <LoadingButton
                        variant="contained"
                        loading={createMutation.isPending}
                        disabled={!name || !salaryAmount}
                        onClick={() =>
                            createMutation.mutate({
                                name,
                                designation: designation || undefined,
                                salary_amount: Number(salaryAmount),
                                salary_type: 'monthly',
                                hire_date: hireDate || undefined,
                            })
                        }
                    >
                        {t('actions.save')}
                    </LoadingButton>
                </DialogActions>
            </Dialog>

            <Dialog open={advancing !== null} onClose={() => setAdvancing(null)} fullWidth maxWidth="xs">
                <DialogTitle>{t('employees_page.advance_title', { name: advancing?.name })}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        {error && <Alert severity="error">{error}</Alert>}
                        <TextField
                            label={t('fields.amount')}
                            type="number"
                            value={advanceAmount}
                            onChange={(e) => setAdvanceAmount(e.target.value)}
                            fullWidth
                        />
                        <TextField
                            select
                            label={t('fields.cash_account')}
                            value={advanceCashAccountId}
                            onChange={(e) => setAdvanceCashAccountId(Number(e.target.value))}
                            fullWidth
                        >
                            {cashAccounts?.map((a) => (
                                <MenuItem key={a.id} value={a.id}>
                                    {a.name}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            label={t('fields.reason')}
                            value={advanceReason}
                            onChange={(e) => setAdvanceReason(e.target.value)}
                            fullWidth
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAdvancing(null)}>{t('actions.cancel')}</Button>
                    <LoadingButton
                        variant="contained"
                        loading={advanceMutation.isPending}
                        disabled={!advanceAmount || !advanceCashAccountId}
                        onClick={() => advanceMutation.mutate()}
                    >
                        {t('actions.save')}
                    </LoadingButton>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
