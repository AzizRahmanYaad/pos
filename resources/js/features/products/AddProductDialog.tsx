import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Grid,
    IconButton,
    InputAdornment,
    MenuItem,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import {
    createCategory,
    createProduct,
    createUnit,
    fetchCategories,
    fetchUnits,
} from '@/features/products/api';

const PRODUCT_TYPES = ['standard', 'service', 'raw_material'] as const;

interface AddProductDialogProps {
    open: boolean;
    onClose: () => void;
}

export function AddProductDialog({ open, onClose }: AddProductDialogProps) {
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
    const [salePrice, setSalePrice] = useState('');
    const [pricingMode, setPricingMode] = useState<'fixed' | 'margin'>('fixed');
    const [marginPercent, setMarginPercent] = useState('');
    const [defaultCost, setDefaultCost] = useState('');
    const [taxRate, setTaxRate] = useState('0');
    const [reorderLevel, setReorderLevel] = useState('0');
    const [trackInventory, setTrackInventory] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Inline quick-create for categories and units.
    const [creating, setCreating] = useState<'category' | 'unit' | null>(null);
    const [newName, setNewName] = useState('');
    const [newShortName, setNewShortName] = useState('');

    const reset = () => {
        setName('');
        setSku('');
        setBarcode('');
        setCategoryId('');
        setUnitId('');
        setType('standard');
        setSalePrice('');
        setPricingMode('fixed');
        setMarginPercent('');
        setDefaultCost('');
        setTaxRate('0');
        setReorderLevel('0');
        setTrackInventory(true);
        setError(null);
    };

    const close = () => {
        reset();
        onClose();
    };

    const saveMutation = useMutation({
        mutationFn: () =>
            createProduct({
                name,
                sku,
                barcode: barcode || undefined,
                category_id: categoryId === '' ? undefined : categoryId,
                unit_id: unitId as number,
                type,
                sale_price: Number(salePrice),
                pricing_mode: pricingMode,
                margin_percent: pricingMode === 'margin' ? Number(marginPercent || 0) : undefined,
                default_cost: Number(defaultCost || 0),
                tax_rate: Number(taxRate || 0),
                reorder_level: Number(reorderLevel || 0),
                track_inventory: type === 'service' ? false : trackInventory,
                is_active: true,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            close();
        },
        onError: () => setError(t('products_page.create_failed')),
    });

    const quickCreateMutation = useMutation({
        mutationFn: async () => {
            if (creating === 'category') {
                return { kind: 'category' as const, item: await createCategory(newName) };
            }
            return { kind: 'unit' as const, item: await createUnit(newName, newShortName) };
        },
        onSuccess: (result) => {
            if (result.kind === 'category') {
                queryClient.invalidateQueries({ queryKey: ['categories'] });
                setCategoryId(result.item.id);
            } else {
                queryClient.invalidateQueries({ queryKey: ['units'] });
                setUnitId(result.item.id);
            }
            setCreating(null);
            setNewName('');
            setNewShortName('');
        },
    });

    const canSave =
        name !== '' &&
        sku !== '' &&
        unitId !== '' &&
        salePrice !== '' &&
        (pricingMode === 'fixed' || marginPercent !== '');

    return (
        <>
            <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
                <DialogTitle>{t('products_page.new_product')}</DialogTitle>
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
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end" sx={{ mr: 3 }}>
                                                <Tooltip title={t('products_page.new_category')}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => setCreating('category')}
                                                    >
                                                        <AddIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </InputAdornment>
                                        ),
                                    }}
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
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end" sx={{ mr: 3 }}>
                                                <Tooltip title={t('products_page.new_unit')}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => setCreating('unit')}
                                                    >
                                                        <AddIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </InputAdornment>
                                        ),
                                    }}
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
                                    label={t('fields.price')}
                                    type="number"
                                    value={salePrice}
                                    onChange={(e) => setSalePrice(e.target.value)}
                                    fullWidth
                                />
                            </Grid>
                            <Grid item xs={6} sm={3}>
                                <TextField
                                    label={t('fields.unit_cost')}
                                    type="number"
                                    value={defaultCost}
                                    onChange={(e) => setDefaultCost(e.target.value)}
                                    fullWidth
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    select
                                    label={t('products_page.pricing_mode')}
                                    value={pricingMode}
                                    onChange={(e) => setPricingMode(e.target.value as 'fixed' | 'margin')}
                                    fullWidth
                                >
                                    <MenuItem value="fixed">{t('products_page.pricing_fixed')}</MenuItem>
                                    <MenuItem value="margin">{t('products_page.pricing_margin')}</MenuItem>
                                </TextField>
                            </Grid>
                            {pricingMode === 'margin' && (
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        label={t('products_page.margin_percent')}
                                        type="number"
                                        value={marginPercent}
                                        onChange={(e) => setMarginPercent(e.target.value)}
                                        InputProps={{
                                            endAdornment: <InputAdornment position="end">%</InputAdornment>,
                                        }}
                                        fullWidth
                                    />
                                </Grid>
                            )}
                            {pricingMode === 'margin' && (
                                <Grid item xs={12}>
                                    <Box sx={{ px: 0.5 }}>
                                        <Typography variant="caption" color="text.secondary">
                                            {t('products_page.margin_hint')}
                                        </Typography>
                                    </Box>
                                </Grid>
                            )}
                            <Grid item xs={6} sm={3}>
                                <TextField
                                    label={t('products_page.tax_rate')}
                                    type="number"
                                    value={taxRate}
                                    onChange={(e) => setTaxRate(e.target.value)}
                                    fullWidth
                                />
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
                        </Grid>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={close}>{t('actions.cancel')}</Button>
                    <Button
                        variant="contained"
                        disabled={!canSave || saveMutation.isPending}
                        onClick={() => saveMutation.mutate()}
                    >
                        {t('actions.save')}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={creating !== null} onClose={() => setCreating(null)} maxWidth="xs" fullWidth>
                <DialogTitle>
                    {creating === 'category'
                        ? t('products_page.new_category')
                        : t('products_page.new_unit')}
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            label={t('fields.name')}
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            fullWidth
                            autoFocus
                        />
                        {creating === 'unit' && (
                            <TextField
                                label={t('products_page.unit_short_name')}
                                value={newShortName}
                                onChange={(e) => setNewShortName(e.target.value)}
                                fullWidth
                            />
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreating(null)}>{t('actions.cancel')}</Button>
                    <Button
                        variant="contained"
                        disabled={
                            !newName ||
                            (creating === 'unit' && !newShortName) ||
                            quickCreateMutation.isPending
                        }
                        onClick={() => quickCreateMutation.mutate()}
                    >
                        {t('actions.save')}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
