import { createTheme } from '@mui/material/styles';

export function createAppTheme(direction: 'ltr' | 'rtl') {
    return createTheme({
        direction,
        palette: {
            primary: { main: '#1e6f5c' },
            secondary: { main: '#c9a227' },
        },
        typography: {
            fontFamily: [
                'Vazirmatn',
                'Noto Sans Arabic',
                'Instrument Sans',
                'system-ui',
                'sans-serif',
            ].join(','),
        },
    });
}
