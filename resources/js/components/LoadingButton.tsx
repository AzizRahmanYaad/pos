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
                    size={18}
                    thickness={5}
                    color="inherit"
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        marginTop: '-9px',
                        marginLeft: '-9px',
                    }}
                />
            )}
        </Button>
    );
});
