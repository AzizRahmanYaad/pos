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
import { fetchSuppliers } from '@/features/suppliers/api';

export function SuppliersListPage() {
    const { t } = useTranslation();
    const { data, isLoading, isError } = useQuery({
        queryKey: ['suppliers'],
        queryFn: fetchSuppliers,
    });

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                {t('nav.suppliers')}
            </Typography>

            {isLoading && <CircularProgress />}
            {isError && <Alert severity="error">{t('common.loading')}</Alert>}

            {data && (
                <TableContainer component={Paper}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('nav.suppliers')}</TableCell>
                                <TableCell>Phone</TableCell>
                                <TableCell align="right">Balance</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {data.map((supplier) => (
                                <TableRow key={supplier.id}>
                                    <TableCell>{supplier.name}</TableCell>
                                    <TableCell>{supplier.phone ?? '—'}</TableCell>
                                    <TableCell align="right">
                                        <Chip
                                            size="small"
                                            color={supplier.current_balance < 0 ? 'warning' : 'default'}
                                            label={supplier.current_balance.toFixed(2)}
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
