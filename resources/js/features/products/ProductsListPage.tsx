import { useQuery } from '@tanstack/react-query';
import {
    Alert,
    Box,
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
import { fetchProducts } from '@/features/products/api';

export function ProductsListPage() {
    const { t } = useTranslation();
    const { data, isLoading, isError } = useQuery({
        queryKey: ['products'],
        queryFn: fetchProducts,
    });

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                {t('nav.products')}
            </Typography>

            {isLoading && <CircularProgress />}
            {isError && <Alert severity="error">{t('common.loading')}</Alert>}

            {data && (
                <TableContainer component={Paper}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>SKU</TableCell>
                                <TableCell>{t('nav.products')}</TableCell>
                                <TableCell>{t('nav.inventory')}</TableCell>
                                <TableCell align="right">Stock</TableCell>
                                <TableCell align="right">Price</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {data.map((product) => (
                                <TableRow key={product.id}>
                                    <TableCell>{product.sku}</TableCell>
                                    <TableCell>{product.name}</TableCell>
                                    <TableCell>{product.category_name ?? '—'}</TableCell>
                                    <TableCell align="right">
                                        {product.total_stock} {product.unit_short_name}
                                    </TableCell>
                                    <TableCell align="right">{product.sale_price.toFixed(2)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );
}
