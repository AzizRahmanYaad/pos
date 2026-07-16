import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    FormControlLabel,
    Grid,
    Paper,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
    fetchBusinessSettings,
    updateBusinessSettings,
    updatePassword,
    type BusinessSettings,
} from '@/features/settings/api';
import { Can } from '@/components/Can';

function BusinessSettingsForm() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { data } = useQuery({ queryKey: ['business-settings'], queryFn: fetchBusinessSettings });
    const [form, setForm] = useState<BusinessSettings | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (data) setForm(data);
    }, [data]);

    const mutation = useMutation({
        mutationFn: updateBusinessSettings,
        onSuccess: (updated) => {
            queryClient.setQueryData(['business-settings'], updated);
            setSuccess(true);
        },
    });

    if (!form) return null;

    const set = <K extends keyof BusinessSettings>(key: K, value: BusinessSettings[K]) =>
        setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

    return (
        <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
                {t('nav.settings')}
            </Typography>
            <Stack spacing={2}>
                {success && <Alert severity="success" onClose={() => setSuccess(false)}>{t('actions.save')} ✓</Alert>}
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            label={t('settings_page.company_name')}
                            value={form.company_name}
                            onChange={(e) => set('company_name', e.target.value)}
                            fullWidth
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            label={t('fields.phone')}
                            value={form.phone ?? ''}
                            onChange={(e) => set('phone', e.target.value)}
                            fullWidth
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            label={t('settings_page.address')}
                            value={form.address ?? ''}
                            onChange={(e) => set('address', e.target.value)}
                            fullWidth
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            label={t('settings_page.email')}
                            value={form.email ?? ''}
                            onChange={(e) => set('email', e.target.value)}
                            fullWidth
                        />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <TextField
                            label={t('settings_page.currency_code')}
                            value={form.currency_code}
                            onChange={(e) => set('currency_code', e.target.value)}
                            fullWidth
                        />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <TextField
                            label={t('settings_page.currency_symbol')}
                            value={form.currency_symbol}
                            onChange={(e) => set('currency_symbol', e.target.value)}
                            fullWidth
                        />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <TextField
                            label={t('settings_page.invoice_prefix')}
                            value={form.invoice_prefix}
                            onChange={(e) => set('invoice_prefix', e.target.value)}
                            fullWidth
                        />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <TextField
                            label={t('settings_page.purchase_prefix')}
                            value={form.purchase_prefix}
                            onChange={(e) => set('purchase_prefix', e.target.value)}
                            fullWidth
                        />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <TextField
                            label={t('settings_page.default_tax_rate')}
                            type="number"
                            value={form.default_tax_rate}
                            onChange={(e) => set('default_tax_rate', Number(e.target.value))}
                            fullWidth
                        />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <TextField
                            label={t('settings_page.fiscal_year_start_month')}
                            type="number"
                            value={form.fiscal_year_start_month}
                            onChange={(e) => set('fiscal_year_start_month', Number(e.target.value))}
                            inputProps={{ min: 1, max: 12 }}
                            fullWidth
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField
                            label={t('settings_page.receipt_footer')}
                            value={form.receipt_footer ?? ''}
                            onChange={(e) => set('receipt_footer', e.target.value)}
                            fullWidth
                            multiline
                            minRows={2}
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={form.auto_close_daily}
                                    onChange={(e) => set('auto_close_daily', e.target.checked)}
                                />
                            }
                            label={t('settings_page.auto_close_daily')}
                        />
                    </Grid>
                </Grid>
                <Box>
                    <Button
                        variant="contained"
                        disabled={mutation.isPending}
                        onClick={() => mutation.mutate(form)}
                    >
                        {t('actions.save')}
                    </Button>
                </Box>
            </Stack>
        </Paper>
    );
}

function ChangePasswordForm() {
    const { t } = useTranslation();
    const [currentPassword, setCurrentPassword] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const mutation = useMutation({
        mutationFn: updatePassword,
        onSuccess: () => {
            setCurrentPassword('');
            setPassword('');
            setPasswordConfirmation('');
            setError(null);
            setSuccess(true);
        },
        onError: () => setError(t('settings_page.password_update_failed')),
    });

    const submit = () => {
        setSuccess(false);
        mutation.mutate({
            current_password: currentPassword,
            password,
            password_confirmation: passwordConfirmation,
        });
    };

    return (
        <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
                {t('settings_page.change_password')}
            </Typography>
            <Stack spacing={2} sx={{ maxWidth: 360 }}>
                {error && <Alert severity="error">{error}</Alert>}
                {success && <Alert severity="success" onClose={() => setSuccess(false)}>{t('settings_page.password_updated')}</Alert>}
                <TextField
                    label={t('settings_page.current_password')}
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    fullWidth
                />
                <TextField
                    label={t('settings_page.new_password')}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    fullWidth
                />
                <TextField
                    label={t('settings_page.confirm_password')}
                    type="password"
                    value={passwordConfirmation}
                    onChange={(e) => setPasswordConfirmation(e.target.value)}
                    fullWidth
                />
                <Box>
                    <Button
                        variant="contained"
                        disabled={mutation.isPending || !currentPassword || !password || password !== passwordConfirmation}
                        onClick={submit}
                    >
                        {t('actions.save')}
                    </Button>
                </Box>
            </Stack>
        </Paper>
    );
}

export function SettingsPage() {
    const { t } = useTranslation();

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                {t('nav.settings')}
            </Typography>
            <Stack spacing={3}>
                <Can permission="settings.manage">
                    <BusinessSettingsForm />
                </Can>
                <ChangePasswordForm />
            </Stack>
        </Box>
    );
}
