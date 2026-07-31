import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Alert, Avatar, Box, Grid, IconButton, Paper, Stack, TextField, Typography } from '@mui/material';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import { useTranslation } from 'react-i18next';
import { LoadingButton } from '@/components/LoadingButton';
import { updateProfile } from '@/features/auth/api';
import { useAuthStore } from '@/store/authStore';
import { extractErrorMessage, isOfflineFailure } from '@/lib/queryClient';

function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();
}

/**
 * Your own account details, kept here rather than in User Management so
 * that every account can maintain them — including staff whose admin
 * never granted them the users module.
 */
export function MyAccountForm() {
    const { t } = useTranslation();
    const user = useAuthStore((state) => state.user);
    const setUser = useAuthStore((state) => state.setUser);
    const logoInputRef = useRef<HTMLInputElement | null>(null);

    const [name, setName] = useState(user?.name ?? '');
    const [email, setEmail] = useState(user?.email ?? '');
    const [phone, setPhone] = useState(user?.phone ?? '');
    const [address, setAddress] = useState(user?.address ?? '');
    const [logo, setLogo] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(user?.logo_url ?? null);
    const [error, setError] = useState<string | null>(null);

    const mutation = useMutation({
        mutationFn: () => updateProfile({ name, email, phone, address, logo }),
        meta: {
            successMessage: t('settings_page.profile_saved'),
            errorMessage: t('settings_page.profile_failed'),
        },
        onSuccess: (updated) => {
            // Reflect it immediately in the header avatar and menu.
            setUser(updated);
            setLogo(null);
            setLogoPreview(updated.logo_url);
            setError(null);
        },
        // An email already in use is the usual refusal here, and it is worth
        // saying so: "could not save" leaves somebody retyping a name that
        // was never the problem. An outage is worth separating out — your own
        // account is the one thing the offline queue deliberately will not
        // hold, so there is nothing to wait for and the reason should say so.
        onError: (failure) => setError(
            isOfflineFailure(failure) ? t('offline.needs_connection') : extractErrorMessage(failure),
        ),
    });

    const pickLogo = (file: File | null) => {
        setLogo(file);
        setLogoPreview(file ? URL.createObjectURL(file) : (user?.logo_url ?? null));
    };

    return (
        <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
                {t('settings_page.my_account')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                {t('settings_page.my_account_hint')}
            </Typography>

            <Grid container spacing={2}>
                {error && (
                    <Grid item xs={12}>
                        <Alert severity="error" onClose={() => setError(null)}>
                            {error}
                        </Alert>
                    </Grid>
                )}
                <Grid item xs={12}>
                    <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar src={logoPreview ?? undefined} sx={{ width: 64, height: 64, fontWeight: 700 }}>
                            {initials(name || '?')}
                        </Avatar>
                        <Box>
                            <IconButton onClick={() => logoInputRef.current?.click()} color="primary">
                                <AddPhotoAlternateIcon />
                            </IconButton>
                            <input
                                ref={logoInputRef}
                                type="file"
                                accept="image/*"
                                hidden
                                onChange={(e) => pickLogo(e.target.files?.[0] ?? null)}
                            />
                            <Typography variant="caption" color="text.secondary" display="block">
                                {t('settings_page.logo_hint')}
                            </Typography>
                        </Box>
                    </Stack>
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        label={t('fields.name')}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        fullWidth
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        label={t('auth.email')}
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        fullWidth
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        label={t('fields.phone')}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        fullWidth
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        label={t('parties.address')}
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        fullWidth
                    />
                </Grid>
                <Grid item xs={12}>
                    <LoadingButton
                        variant="contained"
                        loading={mutation.isPending}
                        disabled={name === '' || email === ''}
                        onClick={() => mutation.mutate()}
                    >
                        {t('actions.save')}
                    </LoadingButton>
                </Grid>
            </Grid>
        </Paper>
    );
}
