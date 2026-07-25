import { forwardRef } from 'react';
import { Box, Button, CircularProgress, type ButtonProps } from '@mui/material';

export interface LoadingButtonProps extends ButtonProps {
    loading?: boolean;
}

/**
 * A Button that shows an inline spinner while `loading` is true, without
 * the button changing width or the label jumping around — the label is
 * kept in place (invisible) so the spinner can sit centered over it. Used
 * everywhere a mutation is in flight (Save, Delete, Receive, Pay, etc.) so
 * every action in the app gives the same immediate, professional feedback
 * the login button already did.
 */
export const LoadingButton = forwardRef<HTMLButtonElement, LoadingButtonProps>(function LoadingButton(
    { loading = false, disabled, children, startIcon, sx, ...rest },
    ref,
) {
    return (
        <Button
            ref={ref}
            disabled={disabled || loading}
            startIcon={loading ? undefined : startIcon}
            sx={{ position: 'relative', ...sx }}
            {...rest}
        >
            <Box
                component="span"
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    visibility: loading ? 'hidden' : 'visible',
                }}
            >
                {children}
            </Box>
            {loading && (
                <CircularProgress
                    size={20}
                    thickness={5}
                    sx={{
                        // Deliberately not color="inherit". The button is kept
                        // genuinely disabled while loading (that is what blocks
                        // double-submits), and MUI fades a disabled button's text
                        // to rgba(0,0,0,0.26) over an rgba(0,0,0,0.12) background —
                        // so an inherited spinner rendered as a faint grey arc on
                        // near-identical grey. It was there, but invisible in
                        // practice. A fixed high-contrast colour reads clearly on
                        // the disabled grey of a contained button and on the plain
                        // background of an outlined or text one alike.
                        color: 'text.primary',
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        marginTop: '-10px',
                        marginLeft: '-10px',
                    }}
                />
            )}
        </Button>
    );
});
