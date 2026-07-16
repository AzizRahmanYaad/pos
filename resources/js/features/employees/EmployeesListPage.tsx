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
        onError: () => setError('Could not record advance.'),
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
                                <TableCell>Designation</TableCell>
                                <TableCell align="right">Salary</TableCell>
                                <TableCell align="right">Outstanding advances</TableCell>
                                <TableCell align="right"> </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {employees.map((employee) => (
                                <TableRow key={employee.id}>
                                    <TableCell>{employee.name}</TableCell>
                                    <TableCell>{employee.designation ?? '—'}</TableCell>
                                    <TableCell align="right">
                                        {employee.salary_amount.toFixed(2)} / {employee.salary_type}
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
                                            Give advance
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>New employee</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
                        <TextField
                            label="Designation"
                            value={designation}
                            onChange={(e) => setDesignation(e.target.value)}
                            fullWidth
                        />
                        <TextField
                            label="Monthly salary"
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
                <DialogTitle>Advance — {advancing?.name}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        {error && <Alert severity="error">{error}</Alert>}
                        <TextField
                            label="Amount"
                            type="number"
                            value={advanceAmount}
                            onChange={(e) => setAdvanceAmount(e.target.value)}
                            fullWidth
                        />
                        <TextField
                            select
                            label="Cash account"
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
                            label="Reason"
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
