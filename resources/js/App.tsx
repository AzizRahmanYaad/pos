import { CacheProvider } from '@emotion/react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { router } from '@/app/routes';
import { createEmotionCache } from '@/theme/rtlCache';
import { createAppTheme } from '@/theme/theme';
import { useLocaleStore } from '@/store/localeStore';
import { useAuthStore } from '@/store/authStore';

const queryClient = new QueryClient();

export function App() {
    const direction = useLocaleStore((state) => state.direction);
    const cache = useMemo(() => createEmotionCache(direction), [direction]);
    const theme = useMemo(() => createAppTheme(direction), [direction]);
    const bootstrap = useAuthStore((state) => state.bootstrap);

    useEffect(() => {
        bootstrap();
    }, [bootstrap]);

    return (
        <CacheProvider value={cache}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <QueryClientProvider client={queryClient}>
                    <RouterProvider router={router} />
                </QueryClientProvider>
            </ThemeProvider>
        </CacheProvider>
    );
}
