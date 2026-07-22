import { useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import {
    Alert,
    Avatar,
    Box,
    Divider,
    IconButton,
    InputAdornment,
    Paper,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { LoadingButton } from '@/components/LoadingButton';
import { alpha, useTheme } from '@mui/material/styles';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import { LogoMark } from '@/components/AppLogo';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { Navigate, useLocation, useNavigate, type Location } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const BRAND_FEATURES = [
    { icon: <PointOfSaleIcon fontSize="small" />, key: 'auth.feature_pos' },
    { icon: <Inventory2OutlinedIcon fontSize="small" />, key: 'auth.feature_inventory' },
    { icon: <InsightsOutlinedIcon fontSize="small" />, key: 'auth.feature_reports' },
] as const;

export function LoginPage() {
    const { t } = useTranslation();
    const theme = useTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const status = useAuthStore((state) => state.status);
    const loginAction = useAuthStore((state) => state.login);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
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
        } catch (err) {
            const code = isAxiosError(err) ? err.response?.data?.code : undefined;
            setError(code === 'access_expired' ? t('auth.access_expired') : t('auth.login_error'));
        } finally {
            setSubmitting(false);
        }
    };

    const brandGradient = `linear-gradient(150deg, #7E6420 0%, ${theme.palette.primary.dark} 45%, ${theme.palette.primary.main} 100%)`;

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'stretch',
                background: `radial-gradient(1200px 600px at 85% -10%, ${alpha(theme.palette.primary.main, 0.08)}, transparent),
                             radial-gradient(900px 500px at -10% 110%, ${alpha(theme.palette.secondary.main, 0.1)}, transparent),
                             ${theme.palette.grey[50]}`,
            }}
        >
            {/* Brand panel */}
            <Box
                sx={{
                    flex: '1 1 52%',
                    display: { xs: 'none', md: 'flex' },
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    overflow: 'hidden',
                    color: '#fff',
                    background: brandGradient,
                    p: { md: 6, lg: 8 },
                }}
            >
                {/* Decorative shapes */}
                <Box
                    sx={{
                        position: 'absolute',
                        width: 420,
                        height: 420,
                        borderRadius: '50%',
                        top: -140,
                        insetInlineEnd: -120,
                        background: alpha('#ffffff', 0.06),
                    }}
                />
                <Box
                    sx={{
                        position: 'absolute',
                        width: 280,
                        height: 280,
                        borderRadius: '50%',
                        bottom: -80,
                        insetInlineStart: -60,
                        background: alpha(theme.palette.secondary.main, 0.18),
                        filter: 'blur(2px)',
                    }}
                />
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `radial-gradient(${alpha('#ffffff', 0.12)} 1px, transparent 1px)`,
                        backgroundSize: '26px 26px',
                        maskImage: 'linear-gradient(to bottom, transparent 40%, black)',
                        opacity: 0.5,
                    }}
                />

                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ position: 'relative' }}>
                    <Box
                        sx={{
                            display: 'flex',
                            borderRadius: '14px',
                            boxShadow: `0 0 0 2px ${alpha('#ffffff', 0.25)}`,
                        }}
                    >
                        <LogoMark size={52} />
                    </Box>
                    <Typography variant="h5" fontWeight={800} letterSpacing={0.5}>
                        {t('app_name')}
                    </Typography>
                </Stack>

                <Box sx={{ position: 'relative', maxWidth: 520 }}>
                    <Typography variant="h3" fontWeight={800} lineHeight={1.2} gutterBottom>
                        {t('auth.brand_headline')}
                    </Typography>
                    <Typography variant="h6" fontWeight={400} sx={{ opacity: 0.85, mb: 5 }}>
                        {t('auth.brand_tagline')}
                    </Typography>

                    <Stack spacing={2.5}>
                        {BRAND_FEATURES.map(({ icon, key }) => (
                            <Stack key={key} direction="row" spacing={2} alignItems="center">
                                <Avatar
                                    sx={{
                                        width: 38,
                                        height: 38,
                                        bgcolor: alpha('#ffffff', 0.14),
                                        color: theme.palette.secondary.light,
                                    }}
                                >
                                    {icon}
                                </Avatar>
                                <Typography sx={{ opacity: 0.95 }}>{t(key)}</Typography>
                            </Stack>
                        ))}
                    </Stack>
                </Box>

                <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{ position: 'relative', opacity: 0.75 }}
                >
                    <ShieldOutlinedIcon fontSize="small" />
                    <Typography variant="body2">{t('auth.brand_secure')}</Typography>
                </Stack>
            </Box>

            {/* Form panel */}
            <Box
                sx={{
                    flex: '1 1 48%',
                    display: 'flex',
                    flexDirection: 'column',
                    p: { xs: 2, sm: 4 },
                }}
            >
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <LanguageSwitcher />
                </Box>

                <Box
                    sx={{
                        flexGrow: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Paper
                        elevation={0}
                        sx={{
                            width: '100%',
                            maxWidth: 440,
                            p: { xs: 3, sm: 5 },
                            borderRadius: 4,
                            border: `1px solid ${theme.palette.divider}`,
                            boxShadow: `0 24px 60px -24px ${alpha(theme.palette.primary.main, 0.25)}`,
                            animation: 'loginCardIn 480ms cubic-bezier(0.22, 1, 0.36, 1)',
                            '@keyframes loginCardIn': {
                                from: { opacity: 0, transform: 'translateY(16px)' },
                                to: { opacity: 1, transform: 'translateY(0)' },
                            },
                        }}
                    >
                        {/* Compact brand mark for mobile, where the panel is hidden */}
                        <Stack
                            direction="row"
                            spacing={1.5}
                            alignItems="center"
                            justifyContent="center"
                            sx={{ display: { xs: 'flex', md: 'none' }, mb: 3 }}
                        >
                            <LogoMark size={44} />
                            <Typography variant="h5" fontWeight={800}>
                                {t('app_name')}
                            </Typography>
                        </Stack>

                        <Typography variant="h4" fontWeight={800} gutterBottom>
                            {t('auth.welcome_back')}
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                            {t('auth.sign_in_subtitle')}
                        </Typography>

                        <Box component="form" onSubmit={handleSubmit} noValidate>
                            <Stack spacing={2.5}>
                                {error && (
                                    <Alert severity="error" variant="outlined">
                                        {error}
                                    </Alert>
                                )}
                                <TextField
                                    label={t('auth.email')}
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoFocus
                                    fullWidth
                                    autoComplete="email"
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <EmailOutlinedIcon fontSize="small" color="action" />
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                                <TextField
                                    label={t('auth.password')}
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    fullWidth
                                    autoComplete="current-password"
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <LockOutlinedIcon fontSize="small" color="action" />
                                            </InputAdornment>
                                        ),
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    onClick={() => setShowPassword((v) => !v)}
                                                    edge="end"
                                                    size="small"
                                                    aria-label={t('auth.toggle_password')}
                                                >
                                                    {showPassword ? (
                                                        <VisibilityOffOutlinedIcon fontSize="small" />
                                                    ) : (
                                                        <VisibilityOutlinedIcon fontSize="small" />
                                                    )}
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                                <LoadingButton
                                    type="submit"
                                    variant="contained"
                                    size="large"
                                    loading={submitting}
                                    fullWidth
                                    sx={{
                                        py: 1.5,
                                        borderRadius: 2.5,
                                        fontWeight: 700,
                                        fontSize: '1rem',
                                        textTransform: 'none',
                                        background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                                        boxShadow: `0 12px 24px -10px ${alpha(theme.palette.primary.main, 0.6)}`,
                                        transition: 'transform 150ms ease, box-shadow 150ms ease',
                                        '&:hover': {
                                            transform: 'translateY(-1px)',
                                            boxShadow: `0 16px 28px -10px ${alpha(theme.palette.primary.main, 0.7)}`,
                                        },
                                    }}
                                >
                                    {submitting ? t('auth.signing_in') : t('auth.sign_in')}
                                </LoadingButton>
                            </Stack>
                        </Box>

                        <Divider sx={{ my: 3 }} />
                        <Typography variant="body2" color="text.secondary" align="center">
                            {t('auth.contact_admin')}
                        </Typography>
                    </Paper>
                </Box>

                <Typography variant="caption" color="text.secondary" align="center" sx={{ mt: 2 }}>
                    © {new Date().getFullYear()} {t('app_name')}
                </Typography>
            </Box>
        </Box>
    );
}
