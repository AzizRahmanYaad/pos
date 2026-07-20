import { CacheProvider } from '@emotion/react';
import { CssBaseline, Snackbar, Alert, ThemeProvider } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { router } from '@/app/routes';
import { createEmotionCache } from '@/theme/rtlCache';
import { createAppTheme } from '@/theme/theme';
import { useLocaleStore } from '@/store/localeStore';
import { useAuthStore } from '@/store/authStore';
import { queryClient } from '@/lib/queryClient';

export function App() {
    const direction = useLocaleStore((state) => state.direction);
    const cache = useMemo(() => createEmotionCache(direction), [direction]);
    const theme = useMemo(() => createAppTheme(direction), [direction]);
    const bootstrap = useAuthStore((state) => state.bootstrap);
    const [periodClosedMessage, setPeriodClosedMessage] = useState<string | null>(null);

    useEffect(() => {
        bootstrap();
    }, [bootstrap]);

    useEffect(() => {
        const handler = (event: Event) => {
            const detail = (event as CustomEvent).detail;
            setPeriodClosedMessage(detail?.message ?? 'This date falls within a closed accounting period.');
        };
        window.addEventListener('pos:period-closed', handler);
        return () => window.removeEventListener('pos:period-closed', handler);
    }, []);

    return (
        <CacheProvider value={cache}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <QueryClientProvider client={queryClient}>
                    <RouterProvider router={router} />
                    <Snackbar
                        open={periodClosedMessage !== null}
                        autoHideDuration={6000}
                        onClose={() => setPeriodClosedMessage(null)}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                    >
                        <Alert severity="warning" onClose={() => setPeriodClosedMessage(null)}>
                            {periodClosedMessage}
                        </Alert>
                    </Snackbar>
                </QueryClientProvider>
            </ThemeProvider>
        </CacheProvider>
    );
}
