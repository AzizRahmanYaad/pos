import { useEffect, useState } from 'react';
import {
    Badge,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    List,
    ListItem,
    ListItemText,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined';
import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { useSyncStore } from '@/offline/syncStore';
import { watchConnection } from '@/offline/interceptors';

/**
 * The one honest answer to "did that actually save?".
 *
 * A cashier who has just taken money needs to know whether the sale is on
 * the server or still on this device. Hiding that would be worse than not
 * having offline support at all — they would find out at the end of the
 * day, when the totals disagree.
 */
export function ConnectionStatus() {
    const { t } = useTranslation();
    const user = useAuthStore((state) => state.user);
    const status = useSyncStore((state) => state.status);
    const unsent = useSyncStore((state) => state.unsent);
    const conflicts = useSyncStore((state) => state.conflicts);
    const sync = useSyncStore((state) => state.sync);
    const dismissConflict = useSyncStore((state) => state.dismissConflict);
    const refresh = useSyncStore((state) => state.refresh);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!user) return undefined;

        void refresh(user.id);

        return watchConnection(() => useAuthStore.getState().user?.id ?? null);
    }, [user, refresh]);

    if (!user) return null;

    const offline = status === 'offline';
    const syncing = status === 'syncing';
    const hasConflicts = conflicts.length > 0;

    // Everything sent, connection fine, nothing to say — so say nothing.
    if (!offline && !syncing && unsent === 0 && !hasConflicts) return null;

    const label = hasConflicts
        ? t('offline.conflicts', { count: conflicts.length })
        : syncing
          ? t('offline.syncing')
          : offline
            ? unsent > 0
                ? t('offline.offline_with_pending', { count: unsent })
                : t('offline.offline')
            : t('offline.pending', { count: unsent });

    const icon = hasConflicts ? (
        <ErrorOutlineIcon fontSize="small" />
    ) : syncing ? (
        <CircularProgress size={14} sx={{ color: 'inherit' }} />
    ) : offline ? (
        <CloudOffOutlinedIcon fontSize="small" />
    ) : (
        <CloudDoneOutlinedIcon fontSize="small" />
    );

    return (
        <>
            <Tooltip title={t('offline.tap_for_detail')}>
                <Chip
                    icon={icon}
                    label={label}
                    size="small"
                    onClick={() => setOpen(true)}
                    color={hasConflicts ? 'error' : offline ? 'warning' : 'default'}
                    variant={hasConflicts || offline ? 'filled' : 'outlined'}
                    sx={{ fontWeight: 600, flexShrink: 0 }}
                />
            </Tooltip>

            <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>{t('offline.title')}</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2}>
                        <Typography variant="body2" color="text.secondary">
                            {offline ? t('offline.explain_offline') : t('offline.explain_online')}
                        </Typography>

                        {unsent > 0 && (
                            <Box>
                                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                                    {t('offline.pending', { count: unsent })}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {t('offline.pending_hint')}
                                </Typography>
                            </Box>
                        )}

                        {hasConflicts && (
                            <Box>
                                <Typography variant="subtitle2" fontWeight={700} color="error" gutterBottom>
                                    {t('offline.conflicts_title')}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                    {t('offline.conflicts_hint')}
                                </Typography>
                                <List dense disablePadding>
                                    {conflicts.map((entry) => (
                                        <ListItem
                                            key={entry.id}
                                            disableGutters
                                            secondaryAction={
                                                <Button size="small" onClick={() => void dismissConflict(entry.id, user.id)}>
                                                    {t('offline.discard')}
                                                </Button>
                                            }
                                        >
                                            <ListItemText
                                                primary={entry.label}
                                                secondary={`${new Date(entry.createdAt).toLocaleString()} — ${entry.error ?? ''}`}
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            </Box>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpen(false)}>{t('actions.close', 'Close')}</Button>
                    <Button
                        variant="contained"
                        startIcon={<SyncOutlinedIcon />}
                        disabled={syncing || unsent === 0}
                        onClick={() => void sync(user.id)}
                    >
                        {t('offline.sync_now')}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}

/** The compact form for the header, badge and all. */
export function ConnectionBadge() {
    const unsent = useSyncStore((state) => state.unsent);

    return (
        <Badge badgeContent={unsent} color="warning" overlap="circular">
            <ConnectionStatus />
        </Badge>
    );
}
