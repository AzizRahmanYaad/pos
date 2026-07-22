import { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { useRequestLoadingStore } from '@/lib/loadingStore';

/**
 * A slim, brand-gradient progress bar fixed to the top of the viewport.
 * Reflects every in-flight API call app-wide (login, every mutation,
 * every page fetch, logout) without any per-call wiring — it grows while
 * requests are outstanding and glides to completion when the last one
 * resolves, the same pattern used by GitHub/YouTube-style route indicators.
 */
export function TopProgressBar() {
    const activeRequests = useRequestLoadingStore((state) => state.activeRequests);
    const busy = activeRequests > 0;

    const [progress, setProgress] = useState(0);
    const [visible, setVisible] = useState(false);
    const growTimer = useRef<number | undefined>(undefined);
    const hideTimer = useRef<number | undefined>(undefined);

    useEffect(() => {
        if (busy) {
            window.clearTimeout(hideTimer.current);
            setVisible(true);
            growTimer.current = window.setInterval(() => {
                setProgress((p) => Math.min(88, p + (88 - p) * 0.12 + 0.6));
            }, 180);
        } else {
            window.clearInterval(growTimer.current);
            setProgress((p) => (p > 0 ? 100 : p));
            hideTimer.current = window.setTimeout(() => {
                setVisible(false);
                setProgress(0);
            }, 260);
        }

        return () => window.clearInterval(growTimer.current);
    }, [busy]);

    return (
        <Box
            aria-hidden
            sx={{
                position: 'fixed',
                insetInlineStart: 0,
                insetInlineEnd: 0,
                top: 0,
                height: 3,
                zIndex: (theme) => theme.zIndex.tooltip + 100,
                opacity: visible ? 1 : 0,
                transition: 'opacity 280ms ease',
                pointerEvents: 'none',
            }}
        >
            <Box
                sx={{
                    height: '100%',
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, #0f4a3b 0%, #1e6f5c 45%, #e3bc45 100%)',
                    boxShadow: '0 0 10px 1px rgba(227,188,69,0.55)',
                    transition: progress >= 100 ? 'width 200ms ease' : 'width 350ms ease',
                }}
            />
        </Box>
    );
}
