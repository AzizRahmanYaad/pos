import { useQuery } from '@tanstack/react-query';
import {
    Alert,
    Box,
    Chip,
    CircularProgress,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { fetchCustomers } from '@/features/customers/api';

export function CustomersListPage() {
    const { t } = useTranslation();
    const { data, isLoading, isError } = useQuery({
        queryKey: ['customers'],
        queryFn: fetchCustomers,
    });

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                {t('nav.customers')}
            </Typography>

            {isLoading && <CircularProgress />}
            {isError && <Alert severity="error">{t('common.loading')}</Alert>}

            {data && (
                <TableContainer component={Paper}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('nav.customers')}</TableCell>
                                <TableCell>Phone</TableCell>
                                <TableCell align="right">Balance</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {data.map((customer) => (
                                <TableRow key={customer.id}>
                                    <TableCell>{customer.name}</TableCell>
                                    <TableCell>{customer.phone ?? '—'}</TableCell>
                                    <TableCell align="right">
                                        <Chip
                                            size="small"
                                            color={customer.current_balance > 0 ? 'warning' : 'default'}
                                            label={customer.current_balance.toFixed(2)}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );
}
