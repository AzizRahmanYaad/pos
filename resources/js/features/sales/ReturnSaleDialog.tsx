import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Alert,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { LoadingButton } from '@/components/LoadingButton';
import { refundSale, type SaleDetail } from '@/features/sales/api';

interface ReturnSaleDialogProps {
    sale: SaleDetail | null;
    onClose: () => void;
}

export function ReturnSaleDialog({ sale, onClose }: ReturnSaleDialogProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    // sale_item_id -> quantity to return (only present when selected)
    const [selected, setSelected] = useState<Record<number, string>>({});
    const [error, setError] = useState<string | null>(null);

    const refundableItems = sale?.items.filter((item) => item.refundable_quantity > 0.0001) ?? [];

    useEffect(() => {
        setSelected({});
        setError(null);
    }, [sale]);

    const toggle = (itemId: number, maxQty: number) => {
        setSelected((prev) => {
            const next = { ...prev };
            if (itemId in next) {
                delete next[itemId];
            } else {
                next[itemId] = String(maxQty);
            }
            return next;
        });
    };

    const mutation = useMutation({
        mutationFn: () => {
            const items = Object.entries(selected)
                .filter(([, qty]) => Number(qty) > 0)
                .map(([itemId, qty]) => ({ sale_item_id: Number(itemId), quantity: Number(qty) }));

            const allSelected = refundableItems.every((item) => item.id in selected);
            return refundSale(sale!.id, allSelected ? undefined : { items });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sale', sale?.id] });
            queryClient.invalidateQueries({ queryKey: ['sales-page'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['products-page'] });
            onClose();
        },
        onError: () => setError(t('sales_page.return_failed')),
    });

    if (!sale) return null;

    const selectedCount = Object.keys(selected).length;
    const canSubmit =
        selectedCount > 0 &&
        Object.entries(selected).every(([itemId, qty]) => {
            const item = refundableItems.find((i) => i.id === Number(itemId));
            const value = Number(qty);
            return item && value > 0 && value <= item.refundable_quantity + 0.0001;
        });

    return (
        <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{t('sales_page.return_sale_title', { invoice: sale.invoice_number })}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    {error && <Alert severity="error">{error}</Alert>}
                    <Typography variant="body2" color="text.secondary">
                        {t('sales_page.return_partial_hint')}
                    </Typography>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell padding="checkbox"> </TableCell>
                                <TableCell>{t('fields.product')}</TableCell>
                                <TableCell align="right">{t('sales_page.available_to_return')}</TableCell>
                                <TableCell align="right" sx={{ width: 110 }}>
                                    {t('sales_page.return_quantity')}
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {refundableItems.map((item) => {
                                const isSelected = item.id in selected;
                                return (
                                    <TableRow key={item.id}>
                                        <TableCell padding="checkbox">
                                            <Checkbox
                                                checked={isSelected}
                                                onChange={() => toggle(item.id, item.refundable_quantity)}
                                            />
                                        </TableCell>
                                        <TableCell>{item.product_name}</TableCell>
                                        <TableCell align="right">{item.refundable_quantity}</TableCell>
                                        <TableCell align="right">
                                            <TextField
                                                type="number"
                                                size="small"
                                                value={selected[item.id] ?? ''}
                                                disabled={!isSelected}
                                                onChange={(e) =>
                                                    setSelected((prev) => ({ ...prev, [item.id]: e.target.value }))
                                                }
                                                inputProps={{ max: item.refundable_quantity, min: 0 }}
                                                sx={{ width: 90 }}
                                            />
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                    {refundableItems.length === 0 && (
                        <Typography color="text.secondary">{t('sales_page.nothing_to_return')}</Typography>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('actions.cancel')}</Button>
                <LoadingButton
                    variant="contained"
                    color="error"
                    loading={mutation.isPending}
                    disabled={!canSubmit}
                    onClick={() => mutation.mutate()}
                >
                    {t('sales_page.return')}
                </LoadingButton>
            </DialogActions>
        </Dialog>
    );
}
