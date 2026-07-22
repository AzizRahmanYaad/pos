import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Alert,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Grid,
    MenuItem,
    Stack,
    TextField,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
    fetchCategories,
    fetchUnits,
    updateProduct,
    type ProductListItem,
} from '@/features/products/api';

const PRODUCT_TYPES = ['standard', 'service', 'raw_material'] as const;

interface EditProductDialogProps {
    product: ProductListItem | null;
    onClose: () => void;
}

export function EditProductDialog({ product, onClose }: EditProductDialogProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });
    const { data: units } = useQuery({ queryKey: ['units'], queryFn: fetchUnits });

    const [name, setName] = useState('');
    const [sku, setSku] = useState('');
    const [barcode, setBarcode] = useState('');
    const [categoryId, setCategoryId] = useState<number | ''>('');
    const [unitId, setUnitId] = useState<number | ''>('');
    const [type, setType] = useState<(typeof PRODUCT_TYPES)[number]>('standard');
    const [reorderLevel, setReorderLevel] = useState('0');
    const [trackInventory, setTrackInventory] = useState(true);
    const [isActive, setIsActive] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (product) {
            setName(product.name);
            setSku(product.sku);
            setBarcode(product.barcode ?? '');
            setCategoryId(product.category_id ?? '');
            setUnitId(product.unit_id);
            setType(product.type as (typeof PRODUCT_TYPES)[number]);
            setReorderLevel(String(product.reorder_level));
            setTrackInventory(product.track_inventory);
            setIsActive(product.is_active);
            setError(null);
        }
    }, [product]);

    const saveMutation = useMutation({
        mutationFn: () =>
            updateProduct(product!.id, {
                name,
                sku,
                barcode: barcode || null,
                category_id: categoryId === '' ? null : categoryId,
                unit_id: unitId as number,
                type,
                reorder_level: Number(reorderLevel || 0),
                track_inventory: type === 'service' ? false : trackInventory,
                is_active: isActive,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products-page'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            onClose();
        },
        onError: () => setError(t('products_page.update_failed')),
    });

    if (!product) return null;

    const canSave = name !== '' && sku !== '' && unitId !== '';

    return (
        <Dialog open onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>{t('products_page.edit_product_title', { name: product.name })}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    {error && <Alert severity="error">{error}</Alert>}
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label={t('fields.name')}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                fullWidth
                                autoFocus
                            />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <TextField
                                label={t('fields.sku')}
                                value={sku}
                                onChange={(e) => setSku(e.target.value)}
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <TextField
                                label={t('products_page.barcode')}
                                value={barcode}
                                onChange={(e) => setBarcode(e.target.value)}
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                select
                                label={t('fields.category')}
                                value={categoryId}
                                onChange={(e) =>
                                    setCategoryId(e.target.value === '' ? '' : Number(e.target.value))
                                }
                                fullWidth
                            >
                                <MenuItem value="">{t('common.none')}</MenuItem>
                                {categories?.map((category) => (
                                    <MenuItem key={category.id} value={category.id}>
                                        {category.name}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                select
                                label={t('products_page.unit')}
                                value={unitId}
                                onChange={(e) =>
                                    setUnitId(e.target.value === '' ? '' : Number(e.target.value))
                                }
                                fullWidth
                            >
                                {units?.map((unit) => (
                                    <MenuItem key={unit.id} value={unit.id}>
                                        {unit.name} ({unit.short_name})
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                select
                                label={t('fields.type')}
                                value={type}
                                onChange={(e) => setType(e.target.value as typeof type)}
                                fullWidth
                            >
                                {PRODUCT_TYPES.map((value) => (
                                    <MenuItem key={value} value={value}>
                                        {t(`products_page.type_${value}`)}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <TextField
                                label={t('products_page.reorder_level')}
                                type="number"
                                value={reorderLevel}
                                onChange={(e) => setReorderLevel(e.target.value)}
                                fullWidth
                            />
                        </Grid>
                        {type !== 'service' && (
                            <Grid item xs={12} sm={6} sx={{ display: 'flex', alignItems: 'center' }}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={trackInventory}
                                            onChange={(e) => setTrackInventory(e.target.checked)}
                                        />
                                    }
                                    label={t('products_page.track_inventory')}
                                />
                            </Grid>
                        )}
                        <Grid item xs={12} sm={6} sx={{ display: 'flex', alignItems: 'center' }}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={isActive}
                                        onChange={(e) => setIsActive(e.target.checked)}
                                    />
                                }
                                label={t('status.active')}
                            />
                        </Grid>
                    </Grid>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('actions.cancel')}</Button>
                <Button
                    variant="contained"
                    disabled={!canSave || saveMutation.isPending}
                    onClick={() => saveMutation.mutate()}
                >
                    {t('actions.save')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
