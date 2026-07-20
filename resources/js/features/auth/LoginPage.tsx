import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, Card, CardContent, Stack, TextField, Typography, CircularProgress, InputAdornment } from '@mui/material';
import { Navigate, useLocation, useNavigate, type Location } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';

export function LoginPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const status = useAuthStore((state) => state.status);
    const user = useAuthStore((state) => state.user);
    const loginAction = useAuthStore((state) => state.login);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    if (status === 'authenticated' && user) {
        const isSuperAdmin = user.roles.includes('superadmin');
        const from = (location.state as { from?: Location })?.from?.pathname ?? '/';
        const defaultPath = isSuperAdmin ? '/superadmin' : '/';
        return <Navigate to={from === '/' ? defaultPath : from} replace />;
    }

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            await loginAction(email, password);
            const user = useAuthStore.getState().user;
            const isAdmin = user?.roles.includes('superadmin') ?? false;
            navigate(isAdmin ? '/superadmin' : '/', { replace: true });
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
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: '-50%',
                    right: '-10%',
                    width: '500px',
                    height: '500px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    animation: 'float 8s ease-in-out infinite',
                },
                '&::after': {
                    content: '""',
                    position: 'absolute',
                    bottom: '-30%',
                    left: '-5%',
                    width: '400px',
                    height: '400px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.03)',
                    animation: 'float 10s ease-in-out infinite reverse',
                },
                '@keyframes float': {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(20px)' },
                },
            }}
        >
            {/* Language Switcher */}
            <Box sx={{ position: 'absolute', top: 20, right: 20, zIndex: 10 }}>
                <LanguageSwitcher />
            </Box>

            {/* Main Content */}
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    px: 2,
                    position: 'relative',
                    zIndex: 1,
                }}
            >
                {/* Logo/Icon Section */}
                <Box
                    sx={{
                        mb: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(10px)',
                        border: '2px solid rgba(255, 255, 255, 0.25)',
                        animation: 'fadeInDown 0.6s ease-out',
                        '@keyframes fadeInDown': {
                            from: { opacity: 0, transform: 'translateY(-30px)' },
                            to: { opacity: 1, transform: 'translateY(0)' },
                        },
                    }}
                >
                    <Box
                        sx={{
                            fontSize: 40,
                            color: '#fff',
                            fontWeight: 'bold',
                            textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                        }}
                    >
                        📊
                    </Box>
                </Box>

                {/* Login Card */}
                <Card
                    sx={{
                        width: '100%',
                        maxWidth: 420,
                        borderRadius: 3,
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                        background: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(10px)',
                        animation: 'fadeInUp 0.8s ease-out',
                        '@keyframes fadeInUp': {
                            from: { opacity: 0, transform: 'translateY(30px)' },
                            to: { opacity: 1, transform: 'translateY(0)' },
                        },
                    }}
                >
                    <CardContent sx={{ p: 5 }}>
                        {/* Header */}
                        <Box sx={{ mb: 4, textAlign: 'center' }}>
                            <Typography
                                variant="h4"
                                sx={{
                                    fontWeight: 700,
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    backgroundClip: 'text',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    mb: 1,
                                }}
                            >
                                {t('app_name')}
                            </Typography>
                            <Typography variant="body2" color="textSecondary" sx={{ fontWeight: 500 }}>
                                {t('auth.welcome_back')}
                            </Typography>
                        </Box>

                        {/* Form */}
                        <Box component="form" onSubmit={handleSubmit} noValidate>
                            <Stack spacing={2.5}>
                                {/* Error Alert */}
                                {error && (
                                    <Alert
                                        severity="error"
                                        sx={{
                                            borderRadius: 2,
                                            border: '1px solid #ffebee',
                                            background: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)',
                                        }}
                                    >
                                        {error}
                                    </Alert>
                                )}

                                {/* Email Field */}
                                <TextField
                                    fullWidth
                                    label={t('auth.email')}
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoFocus
                                    disabled={submitting}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <EmailOutlinedIcon sx={{ color: '#667eea', mr: 1 }} />
                                            </InputAdornment>
                                        ),
                                    }}
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: 2,
                                            transition: 'all 0.3s ease',
                                            '&:hover': {
                                                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.15)',
                                            },
                                            '&.Mui-focused': {
                                                boxShadow: '0 8px 24px rgba(102, 126, 234, 0.25)',
                                            },
                                        },
                                    }}
                                />

                                {/* Password Field */}
                                <TextField
                                    fullWidth
                                    label={t('auth.password')}
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={submitting}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <LockOutlinedIcon sx={{ color: '#667eea', mr: 1 }} />
                                            </InputAdornment>
                                        ),
                                    }}
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: 2,
                                            transition: 'all 0.3s ease',
                                            '&:hover': {
                                                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.15)',
                                            },
                                            '&.Mui-focused': {
                                                boxShadow: '0 8px 24px rgba(102, 126, 234, 0.25)',
                                            },
                                        },
                                    }}
                                />

                                {/* Submit Button */}
                                <Button
                                    type="submit"
                                    fullWidth
                                    size="large"
                                    disabled={submitting}
                                    sx={{
                                        mt: 1,
                                        py: 1.5,
                                        borderRadius: 2,
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        color: '#fff',
                                        fontWeight: 600,
                                        fontSize: '1rem',
                                        textTransform: 'none',
                                        transition: 'all 0.3s ease',
                                        '&:hover': {
                                            transform: 'translateY(-2px)',
                                            boxShadow: '0 12px 32px rgba(102, 126, 234, 0.4)',
                                        },
                                        '&:active': {
                                            transform: 'translateY(0)',
                                        },
                                        '&.Mui-disabled': {
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            opacity: 0.7,
                                        },
                                    }}
                                >
                                    {submitting ? (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                            <CircularProgress size={20} sx={{ color: '#fff' }} />
                                            <span>{t('auth.signing_in')}</span>
                                        </Box>
                                    ) : (
                                        t('auth.sign_in')
                                    )}
                                </Button>
                            </Stack>
                        </Box>

                        {/* Footer */}
                        <Typography
                            variant="caption"
                            align="center"
                            sx={{
                                display: 'block',
                                mt: 3.5,
                                color: 'textSecondary',
                                fontWeight: 500,
                            }}
                        >
                            © 2024 {t('app_name')}. All rights reserved.
                        </Typography>
                    </CardContent>
                </Card>
            </Box>
        </Box>
    );
}
