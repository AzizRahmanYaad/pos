import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { Navigate, useLocation, useNavigate, type Location } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export function LoginPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const status = useAuthStore((state) => state.status);
    const loginAction = useAuthStore((state) => state.login);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    if (status === 'authenticated') {
        const from = (location.state as { from?: Location })?.from?.pathname ?? '/';
        return <Navigate to={from} replace />;
    }

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            await loginAction(email, password);
            navigate('/', { replace: true });
        } catch {
            setError(t('auth.login_error'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                gap: 3,
                p: 2,
            }}
        >
            <Box sx={{ alignSelf: 'flex-end' }}>
                <LanguageSwitcher />
            </Box>
            <Paper elevation={3} sx={{ p: 4, width: '100%', maxWidth: 400 }}>
                <Typography variant="h5" align="center" gutterBottom>
                    {t('app_name')}
                </Typography>
                <Box component="form" onSubmit={handleSubmit} noValidate>
                    <Stack spacing={2}>
                        {error && <Alert severity="error">{error}</Alert>}
                        <TextField
                            label={t('auth.email')}
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoFocus
                            fullWidth
                        />
                        <TextField
                            label={t('auth.password')}
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            fullWidth
                        />
                        <Button type="submit" variant="contained" size="large" disabled={submitting} fullWidth>
                            {submitting ? t('auth.signing_in') : t('auth.sign_in')}
                        </Button>
                    </Stack>
                </Box>
            </Paper>
        </Box>
    );
}
