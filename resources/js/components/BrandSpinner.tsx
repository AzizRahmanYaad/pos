import { Box, Typography, keyframes } from '@mui/material';
import { LogoMark } from '@/components/AppLogo';

const spin = keyframes`
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
`;

const pulse = keyframes`
    0%, 100% { transform: scale(0.94); opacity: 0.88; }
    50% { transform: scale(1); opacity: 1; }
`;

interface BrandSpinnerProps {
    /** Overall diameter in px. */
    size?: number;
    /** Optional caption shown under the spinner. */
    label?: string;
    /** Centers the spinner (and label) in a full block, for whole-page/section loading states. */
    fullPage?: boolean;
    minHeight?: number | string;
}

/**
 * The app's signature loading indicator: a rotating brand-gradient ring
 * (deep green to gold, matching the اسان حساب mark) around a gently
 * pulsing copy of the logo itself. Used for full-page/section loading —
 * the boot screen, protected-route auth check, and detail-page loads —
 * everywhere a plain spinner would otherwise appear.
 */
export function BrandSpinner({ size = 64, label, fullPage = false, minHeight }: BrandSpinnerProps) {
    const ringWidth = Math.max(3, Math.round(size / 16));
    const logoSize = Math.round(size * 0.56);

    const spinner = (
        <Box
            sx={{
                position: 'relative',
                width: size,
                height: size,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <Box
                component="svg"
                viewBox="0 0 50 50"
                sx={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    animation: `${spin} 1.15s linear infinite`,
                }}
            >
                <defs>
                    <linearGradient id="brandSpinnerRing" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#0f4a3b" />
                        <stop offset="55%" stopColor="#1e6f5c" />
                        <stop offset="100%" stopColor="#e3bc45" />
                    </linearGradient>
                </defs>
                <circle cx="25" cy="25" r="20" fill="none" stroke="rgba(63,63,70,0.1)" strokeWidth={ringWidth} />
                <circle
                    cx="25"
                    cy="25"
                    r="20"
                    fill="none"
                    stroke="url(#brandSpinnerRing)"
                    strokeWidth={ringWidth}
                    strokeLinecap="round"
                    strokeDasharray="70 125"
                />
            </Box>
            <Box sx={{ animation: `${pulse} 1.6s ease-in-out infinite` }}>
                <LogoMark size={logoSize} />
            </Box>
        </Box>
    );

    if (!fullPage && !label) {
        return spinner;
    }

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                ...(fullPage ? { width: '100%', minHeight: minHeight ?? '60vh', py: 6 } : {}),
            }}
        >
            {spinner}
            {label && (
                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                    {label}
                </Typography>
            )}
        </Box>
    );
}
