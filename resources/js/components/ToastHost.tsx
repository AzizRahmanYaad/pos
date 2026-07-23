import { useEffect, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';
import { useToastStore, type ToastMessage } from '@/store/toastStore';

/**
 * Renders queued toasts one at a time (the classic MUI Snackbar queue
 * pattern) so a burst of messages — e.g. a save followed by a list
 * refresh — never overlaps or gets dropped.
 */
export function ToastHost() {
    const toasts = useToastStore((state) => state.toasts);
    const dismiss = useToastStore((state) => state.dismiss);
    const [current, setCurrent] = useState<ToastMessage | null>(null);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (toasts.length && !current) {
            setCurrent(toasts[0]);
            setOpen(true);
        } else if (toasts.length && current && open) {
            setOpen(false);
        }
    }, [toasts, current, open]);

    const handleClose = (_event: unknown, reason?: string) => {
        if (reason === 'clickaway') return;
        setOpen(false);
    };

    const handleExited = () => {
        if (current) dismiss(current.id);
        setCurrent(null);
    };

    return (
        <Snackbar
            open={open}
            autoHideDuration={4000}
            onClose={handleClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            slotProps={{ transition: { onExited: handleExited } }}
        >
            {current ? (
                <Alert onClose={handleClose} severity={current.severity} variant="filled" sx={{ width: '100%' }}>
                    {current.message}
                </Alert>
            ) : undefined}
        </Snackbar>
    );
}
