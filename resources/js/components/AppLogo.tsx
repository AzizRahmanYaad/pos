import { Stack, Typography } from '@mui/material';

/**
 * اسان حساب brand mark: a POS receipt with a rising sales chart and a
 * gold "settled" checkmark, on the brand's green squircle.
 */
export function LogoMark({ size = 40 }: { size?: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="اسان حساب"
        >
            <defs>
                <linearGradient id="asanBg" x1="8" y1="6" x2="58" y2="60" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#0f4a3b" />
                    <stop offset="0.55" stopColor="#1e6f5c" />
                    <stop offset="1" stopColor="#2e8f75" />
                </linearGradient>
                <linearGradient id="asanGold" x1="36" y1="36" x2="56" y2="56" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#e3bc45" />
                    <stop offset="1" stopColor="#b8901f" />
                </linearGradient>
            </defs>

            {/* Squircle background */}
            <rect x="3" y="3" width="58" height="58" rx="15" fill="url(#asanBg)" />
            {/* Soft top sheen */}
            <path
                d="M3 18C3 9.7 9.7 3 18 3h28c8.3 0 15 6.7 15 15v4C46 15 22 15 3 26v-8Z"
                fill="#ffffff"
                opacity="0.07"
            />

            {/* Receipt */}
            <path
                d="M22 12h20a3 3 0 0 1 3 3v32l-3.25 3.5L38.5 47l-3.25 3.5L32 47l-3.25 3.5L25.5 47l-3.25 3.5L19 47V15a3 3 0 0 1 3-3Z"
                fill="#ffffff"
            />

            {/* Item lines */}
            <rect x="23" y="17.5" width="18" height="3" rx="1.5" fill="#b9d8cd" />
            <rect x="23" y="23.5" width="12" height="3" rx="1.5" fill="#b9d8cd" />

            {/* Mini sales chart */}
            <rect x="23" y="37" width="4.5" height="6" rx="1" fill="#8fc3b2" />
            <rect x="29.5" y="33" width="4.5" height="10" rx="1" fill="#2e8f75" />
            <rect x="36" y="29" width="4.5" height="14" rx="1" fill="url(#asanGold)" />

            {/* Gold check badge */}
            <circle cx="46" cy="46" r="10.5" fill="url(#asanGold)" stroke="#ffffff" strokeWidth="2.5" />
            <path
                d="m41.6 46.3 3.1 3.1 6-6"
                stroke="#ffffff"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

interface AppLogoProps {
    size?: number;
    color?: string;
    fontSize?: string | number;
}

/** Brand mark with the اسان حساب wordmark beside it. */
export function AppLogo({ size = 40, color = 'inherit', fontSize = '1.35rem' }: AppLogoProps) {
    return (
        <Stack direction="row" spacing={1.25} alignItems="center">
            <LogoMark size={size} />
            <Typography
                component="span"
                sx={{ fontWeight: 800, letterSpacing: 0.3, color, fontSize, lineHeight: 1 }}
            >
                اسان حساب
            </Typography>
        </Stack>
    );
}
