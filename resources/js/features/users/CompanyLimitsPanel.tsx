import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Box,
    Chip,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { LoadingButton } from '@/components/LoadingButton';
import { fetchTenants, updateTenantUserLimit, type TenantItem } from '@/features/users/api';

/**
 * The platform owner's control over how many accounts each business may
 * create. Shown alongside the user list because that is where the question
 * "why can't this company add another user?" actually comes up.
 */
export function CompanyLimitsPanel() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [drafts, setDrafts] = useState<Record<number, string>>({});

    const { data: tenants } = useQuery({ queryKey: ['tenants'], queryFn: fetchTenants });

    const saveMutation = useMutation({
        mutationFn: ({ id, maxUsers }: { id: number; maxUsers: number | null }) =>
            updateTenantUserLimit(id, maxUsers),
        meta: { successMessage: t('users_page.limit.save_success') },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tenants'] });
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
    });

    const draftFor = (tenant: TenantItem) => drafts[tenant.id] ?? (tenant.max_users?.toString() ?? '');

    if (!tenants || tenants.length === 0) {
        return null;
    }

    return (
        <Paper variant="outlined" sx={{ mb: 3, borderRadius: 2 }}>
            <Box sx={{ px: 2.5, pt: 2, pb: 1 }}>
                <Typography variant="subtitle1" fontWeight={800}>
                    {t('users_page.limit.companies')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    {t('users_page.limit.max_users_hint')}
                </Typography>
            </Box>
            <TableContainer>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>{t('users_page.limit.company')}</TableCell>
                            <TableCell align="right">{t('users_page.limit.used')}</TableCell>
                            <TableCell sx={{ width: 200 }}>{t('users_page.limit.max_users')}</TableCell>
                            <TableCell sx={{ width: 120 }} />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {tenants.map((tenant) => {
                            const draft = draftFor(tenant);
                            const parsed = draft.trim() === '' ? null : Number(draft);
                            const dirty = parsed !== tenant.max_users;
                            const saving = saveMutation.isPending && saveMutation.variables?.id === tenant.id;

                            return (
                                <TableRow key={tenant.id} hover>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={600}>
                                            {tenant.name}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Chip
                                            size="small"
                                            variant="outlined"
                                            color={
                                                tenant.remaining_user_slots === 0 ? 'warning' : 'default'
                                            }
                                            label={
                                                tenant.max_users === null
                                                    ? tenant.user_count
                                                    : t('users_page.limit.usage', {
                                                          used: tenant.user_count,
                                                          max: tenant.max_users,
                                                      })
                                            }
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <TextField
                                            size="small"
                                            type="number"
                                            value={draft}
                                            placeholder={t('users_page.limit.unlimited')}
                                            onChange={(e) =>
                                                setDrafts((d) => ({ ...d, [tenant.id]: e.target.value }))
                                            }
                                            fullWidth
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Stack direction="row" justifyContent="flex-end">
                                            <LoadingButton
                                                size="small"
                                                variant={dirty ? 'contained' : 'text'}
                                                disabled={!dirty}
                                                loading={saving}
                                                onClick={() =>
                                                    saveMutation.mutate({ id: tenant.id, maxUsers: parsed })
                                                }
                                            >
                                                {t('actions.save')}
                                            </LoadingButton>
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
}
