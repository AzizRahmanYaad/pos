import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    InputAdornment,
    MenuItem,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { updateProductPricing, type ProductListItem } from '@/features/products/api';
import { fetchBusinessSettings } from '@/features/settings/api';

interface EditPricingDialogProps {
    product: ProductListItem | null;
    onClose: () => void;
}

export function EditPricingDialog({ product, onClose }: EditPricingDialogProps) {
    const { t } = useTranslation();
    const theme = useTheme();
    const queryClient = useQueryClient();

    const { data: settings } = useQuery({ queryKey: ['business-settings'], queryFn: fetchBusinessSettings });
    const sym = settings?.currency_symbol ?? '';
    const money = (v: number) =>
        `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${sym ? ` ${sym}` : ''}`;

    const [pricingMode, setPricingMode] = useState<'fixed' | 'margin'>('fixed');
    const [marginPercent, setMarginPercent] = useState('');
    const [salePrice, setSalePrice] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (product) {
            setPricingMode(product.pricing_mode);
            setMarginPercent(product.margin_percent !== null ? String(product.margin_percent) : '');
            setSalePrice(String(product.sale_price));
            setError(null);
        }
    }, [product]);

    const saveMutation = useMutation({
        mutationFn: () =>
            updateProductPricing(product!.id, {
                pricing_mode: pricingMode,
                margin_percent: pricingMode === 'margin' ? Number(marginPercent || 0) : null,
                sale_price: pricingMode === 'fixed' ? Number(salePrice) : undefined,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products-page'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            onClose();
        },
        onError: () => setError(t('products_page.pricing_save_failed')),
    });

    if (!product) return null;

    const previewPrice =
        pricingMode === 'margin' && marginPercent !== ''
            ? product.average_cost * (1 + Number(marginPercent) / 100)
            : Number(salePrice || 0);

    const canSave = pricingMode === 'fixed' ? salePrice !== '' : marginPercent !== '';

    return (
        <Dialog open onClose={onClose} fullWidth maxWidth="xs">
            <DialogTitle>{t('products_page.edit_pricing_title', { name: product.name })}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    {error && <Alert severity="error">{error}</Alert>}

                    <Box
                        sx={{
                            p: 1.5,
                            borderRadius: 2,
                            bgcolor: alpha(theme.palette.primary.main, 0.06),
                            display: 'flex',
                            justifyContent: 'space-between',
                        }}
                    >
                        <Typography variant="body2" color="text.secondary">
                            {t('products_page.current_cost')}
                        </Typography>
                        <Typography variant="body2" fontWeight={700}>
                            {money(product.average_cost)}
                        </Typography>
                    </Box>

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

                    {pricingMode === 'fixed' ? (
                        <TextField
                            label={t('fields.price')}
                            type="number"
                            value={salePrice}
                            onChange={(e) => setSalePrice(e.target.value)}
                            fullWidth
                        />
                    ) : (
                        <>
                            <TextField
                                label={t('products_page.margin_percent')}
                                type="number"
                                value={marginPercent}
                                onChange={(e) => setMarginPercent(e.target.value)}
                                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                                fullWidth
                            />
                            <Typography variant="caption" color="text.secondary">
                                {t('products_page.margin_hint')}
                            </Typography>
                        </>
                    )}

                    <Box
                        sx={{
                            p: 1.5,
                            borderRadius: 2,
                            bgcolor: alpha(theme.palette.success.main, 0.08),
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <Typography variant="body2" color="text.secondary">
                            {t('products_page.resulting_price')}
                        </Typography>
                        <Typography variant="h6" fontWeight={800} color="success.dark">
                            {money(previewPrice)}
                        </Typography>
                    </Box>
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
