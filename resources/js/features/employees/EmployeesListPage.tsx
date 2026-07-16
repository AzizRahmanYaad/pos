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
import {
    fetchEmployees,
    createEmployee,
    recordEmployeeAdvance,
    type EmployeeListItem,
} from '@/features/employees/api';
import { fetchCashAccounts } from '@/features/cash-accounts/api';

export function EmployeesListPage() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { data: employees } = useQuery({ queryKey: ['employees'], queryFn: fetchEmployees });
    const { data: cashAccounts } = useQuery({ queryKey: ['cash-accounts'], queryFn: fetchCashAccounts });

    const [addOpen, setAddOpen] = useState(false);
    const [name, setName] = useState('');
    const [designation, setDesignation] = useState('');
    const [salaryAmount, setSalaryAmount] = useState('');

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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4">{t('nav.employees')}</Typography>
                <Button variant="contained" onClick={() => setAddOpen(true)}>
                    {t('actions.add')}
                </Button>
            </Box>

            {employees && (
                <TableContainer component={Paper}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('nav.employees')}</TableCell>
                                <TableCell>{t('fields.designation')}</TableCell>
                                <TableCell align="right">{t('fields.salary')}</TableCell>
                                <TableCell align="right">{t('fields.outstanding_advances')}</TableCell>
                                <TableCell align="right"> </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {employees.map((employee) => (
                                <TableRow key={employee.id}>
                                    <TableCell>{employee.name}</TableCell>
                                    <TableCell>{employee.designation ?? '—'}</TableCell>
                                    <TableCell align="right">
                                        {employee.salary_amount.toFixed(2)} /{' '}
                                        {t(`fields.salary_type_${employee.salary_type}`)}
                                    </TableCell>
                                    <TableCell align="right">
                                        {employee.outstanding_advances > 0 ? (
                                            <Chip size="small" color="warning" label={employee.outstanding_advances.toFixed(2)} />
                                        ) : (
                                            '—'
                                        )}
                                    </TableCell>
                                    <TableCell align="right">
                                        <Button size="small" onClick={() => setAdvancing(employee)}>
                                            {t('employees_page.give_advance')}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

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
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAddOpen(false)}>{t('actions.cancel')}</Button>
                    <Button
                        variant="contained"
                        disabled={!name || !salaryAmount || createMutation.isPending}
                        onClick={() =>
                            createMutation.mutate({
                                name,
                                designation: designation || undefined,
                                salary_amount: Number(salaryAmount),
                                salary_type: 'monthly',
                            })
                        }
                    >
                        {t('actions.save')}
                    </Button>
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
                    <Button
                        variant="contained"
                        disabled={!advanceAmount || !advanceCashAccountId || advanceMutation.isPending}
                        onClick={() => advanceMutation.mutate()}
                    >
                        {t('actions.save')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
