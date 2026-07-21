import { createTheme } from '@mui/material/styles';

/** Brand palette matched to the gold analytics reference design. */
export const GOLD = '#C9A227';
export const GOLD_DARK = '#A6852F';
export const GOLD_SOFT = '#F4EFE1';
export const CHARCOAL = '#3F3F46';
const INK = '#1F2430';
const MUTED = '#6B7280';
const BORDER = '#ECECEF';

/** Gold sequential ramp (light → dark) for composition charts. */
export const GOLD_RAMP = ['#E7D28A', '#DCC063', '#C9A227', '#A6852F', '#7E6420', '#5A4715'];

// Latin UI text uses the modern geometric Plus Jakarta Sans; Persian/Dari
// and Pashto use Vazirmatn, a polished modern Arabic-script face. The two
// stacks just swap which family leads so each script gets its best font
// while the other stays available as a fallback (e.g. the آسان حساب mark
// shown even in English).
const LATIN_STACK = "'Plus Jakarta Sans', 'Vazirmatn', system-ui, -apple-system, sans-serif";
const RTL_STACK = "'Vazirmatn', 'Plus Jakarta Sans', system-ui, sans-serif";

export function createAppTheme(direction: 'ltr' | 'rtl') {
    const fontFamily = direction === 'rtl' ? RTL_STACK : LATIN_STACK;

    return createTheme({
        direction,
        palette: {
            mode: 'light',
            primary: { main: GOLD, dark: GOLD_DARK, light: '#DCC063', contrastText: '#ffffff' },
            secondary: { main: CHARCOAL, contrastText: '#ffffff' },
            background: { default: '#F7F7F8', paper: '#ffffff' },
            text: { primary: INK, secondary: MUTED },
            divider: BORDER,
        },
        shape: { borderRadius: 12 },
        typography: {
            fontFamily,
            h3: { fontWeight: 800, letterSpacing: '-0.02em' },
            h4: { fontWeight: 800, letterSpacing: '-0.01em' },
            h5: { fontWeight: 700, letterSpacing: '-0.01em' },
            h6: { fontWeight: 700 },
            button: { textTransform: 'none', fontWeight: 600 },
        },
        components: {
            MuiPaper: {
                styleOverrides: {
                    root: { backgroundImage: 'none' },
                    outlined: { borderColor: BORDER },
                    elevation1: {
                        boxShadow: '0 1px 3px rgba(16,24,40,0.04), 0 1px 2px rgba(16,24,40,0.03)',
                    },
                },
            },
            MuiCard: {
                defaultProps: { variant: 'outlined' },
                styleOverrides: { root: { borderColor: BORDER, borderRadius: 16 } },
            },
            MuiAppBar: {
                defaultProps: { elevation: 0 },
                styleOverrides: {
                    root: {
                        backgroundColor: '#ffffff',
                        color: INK,
                        borderBottom: `1px solid ${BORDER}`,
                    },
                },
            },
            MuiDrawer: {
                styleOverrides: {
                    paper: { backgroundColor: '#ffffff', borderColor: BORDER },
                },
            },
            MuiButton: {
                defaultProps: { disableElevation: true },
                styleOverrides: { root: { borderRadius: 10 } },
            },
            MuiListItemButton: {
                styleOverrides: {
                    root: {
                        borderRadius: 10,
                        marginBottom: 2,
                        '&.Mui-selected': {
                            backgroundColor: GOLD_SOFT,
                            '&:hover': { backgroundColor: '#EFE8D4' },
                        },
                    },
                },
            },
            MuiTableCell: {
                styleOverrides: {
                    head: { fontWeight: 600, color: MUTED },
                },
            },
            MuiChip: {
                styleOverrides: { root: { fontWeight: 600 } },
            },
        },
    });
}
