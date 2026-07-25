import { useMemo, useState } from 'react';
import {
    Box,
    Checkbox,
    Chip,
    Collapse,
    Divider,
    FormControlLabel,
    IconButton,
    MenuItem,
    Paper,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { alpha, useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import type { PermissionModule } from '@/features/users/api';

interface PermissionMatrixProps {
    modules: PermissionModule[];
    presets: Record<string, string[]>;
    value: string[];
    onChange: (permissions: string[]) => void;
}

/**
 * The access screen for one account: every module the admin is allowed to
 * delegate, each collapsible, with a checkbox per action.
 *
 * Modules are grouped exactly as the sidebar groups them, so "what this
 * user can reach" reads the same here as it will look to them once saved.
 */
export function PermissionMatrix({ modules, presets, value, onChange }: PermissionMatrixProps) {
    const { t } = useTranslation();
    const theme = useTheme();
    const [openModules, setOpenModules] = useState<Record<string, boolean>>({});
    const [preset, setPreset] = useState('');

    const selected = useMemo(() => new Set(value), [value]);

    const grouped = useMemo(() => {
        const groups = new Map<string, PermissionModule[]>();

        modules.forEach((module) => {
            groups.set(module.group, [...(groups.get(module.group) ?? []), module]);
        });

        return [...groups.entries()];
    }, [modules]);

    const toggle = (permission: string) => {
        const next = new Set(selected);
        next.has(permission) ? next.delete(permission) : next.add(permission);
        onChange([...next]);
    };

    const setModule = (module: PermissionModule, granted: boolean) => {
        const next = new Set(selected);
        module.actions.forEach((action) => (granted ? next.add(action.permission) : next.delete(action.permission)));
        onChange([...next]);
    };

    const grantedCount = (module: PermissionModule) =>
        module.actions.filter((action) => selected.has(action.permission)).length;

    const applyPreset = (role: string) => {
        setPreset(role);
        if (presets[role]) onChange([...presets[role]]);
    };

    const everyPermission = modules.flatMap((module) => module.actions.map((action) => action.permission));

    return (
        <Stack spacing={1.5}>
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                <TextField
                    select
                    size="small"
                    label={t('users_page.permissions.preset')}
                    value={preset}
                    onChange={(e) => applyPreset(e.target.value)}
                    sx={{ minWidth: 200 }}
                >
                    {Object.keys(presets).map((role) => (
                        <MenuItem key={role} value={role}>
                            {t(`roles.${role}`, role)}
                        </MenuItem>
                    ))}
                </TextField>
                <Box sx={{ flexGrow: 1 }} />
                <Chip
                    size="small"
                    color={selected.size > 0 ? 'primary' : 'default'}
                    variant={selected.size > 0 ? 'filled' : 'outlined'}
                    label={t('users_page.permissions.granted', { count: selected.size, total: everyPermission.length })}
                />
                <Chip
                    size="small"
                    variant="outlined"
                    clickable
                    onClick={() => onChange(everyPermission)}
                    label={t('users_page.permissions.select_all')}
                />
                <Chip
                    size="small"
                    variant="outlined"
                    clickable
                    onClick={() => onChange([])}
                    label={t('users_page.permissions.clear_all')}
                />
            </Stack>

            <Paper variant="outlined" sx={{ maxHeight: 380, overflowY: 'auto' }}>
                {grouped.map(([group, groupModules], groupIndex) => (
                    <Box key={group}>
                        {groupIndex > 0 && <Divider />}
                        <Typography
                            variant="caption"
                            sx={{
                                display: 'block',
                                px: 2,
                                pt: 1.5,
                                pb: 0.5,
                                fontWeight: 800,
                                letterSpacing: 0.7,
                                textTransform: 'uppercase',
                                color: 'text.secondary',
                            }}
                        >
                            {t(`nav_group.${group}`, group)}
                        </Typography>

                        {groupModules.map((module) => {
                            const granted = grantedCount(module);
                            const all = granted === module.actions.length;
                            const open = openModules[module.key] ?? false;

                            return (
                                <Box key={module.key}>
                                    <Stack
                                        direction="row"
                                        alignItems="center"
                                        spacing={1}
                                        sx={{
                                            px: 1.5,
                                            py: 0.75,
                                            bgcolor: granted > 0 ? alpha(theme.palette.primary.main, 0.04) : undefined,
                                        }}
                                    >
                                        <Checkbox
                                            size="small"
                                            checked={all}
                                            indeterminate={granted > 0 && !all}
                                            onChange={(e) => setModule(module, e.target.checked)}
                                        />
                                        <Box
                                            sx={{ flexGrow: 1, minWidth: 0, cursor: 'pointer' }}
                                            onClick={() => setOpenModules((o) => ({ ...o, [module.key]: !open }))}
                                        >
                                            <Typography variant="body2" fontWeight={700} noWrap>
                                                {t(`users_page.permissions.module.${module.key}`, module.key)}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {granted === 0
                                                    ? t('users_page.permissions.none_granted')
                                                    : t('users_page.permissions.granted', {
                                                          count: granted,
                                                          total: module.actions.length,
                                                      })}
                                            </Typography>
                                        </Box>
                                        <IconButton
                                            size="small"
                                            aria-label={t(`users_page.permissions.module.${module.key}`, module.key)}
                                            onClick={() => setOpenModules((o) => ({ ...o, [module.key]: !open }))}
                                        >
                                            {open ? <ExpandLess /> : <ExpandMore />}
                                        </IconButton>
                                    </Stack>

                                    <Collapse in={open} timeout="auto" unmountOnExit>
                                        <Stack
                                            direction="row"
                                            flexWrap="wrap"
                                            useFlexGap
                                            sx={{ px: 4.5, pb: 1.25, columnGap: 2 }}
                                        >
                                            {module.actions.map((action) => (
                                                <FormControlLabel
                                                    key={action.permission}
                                                    control={
                                                        <Checkbox
                                                            size="small"
                                                            checked={selected.has(action.permission)}
                                                            onChange={() => toggle(action.permission)}
                                                        />
                                                    }
                                                    label={
                                                        <Typography variant="body2">
                                                            {t(
                                                                `users_page.permissions.action.${action.action}`,
                                                                action.action,
                                                            )}
                                                        </Typography>
                                                    }
                                                />
                                            ))}
                                        </Stack>
                                    </Collapse>
                                    <Divider />
                                </Box>
                            );
                        })}
                    </Box>
                ))}
            </Paper>
        </Stack>
    );
}
