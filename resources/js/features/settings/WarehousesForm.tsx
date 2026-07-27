import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Box,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    IconButton,
    Paper,
    Stack,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useTranslation } from 'react-i18next';
import { AddButton } from '@/components/AddButton';
import { LoadingButton } from '@/components/LoadingButton';
import {
    createWarehouse,
    deleteWarehouse,
    fetchWarehouses,
    updateWarehouse,
    type WarehouseListItem,
} from '@/features/warehouses/api';

/**
 * Where stock is kept. A shop starts with one and most never need a second,
 * so this lives in Settings rather than in the sidebar — it is something
 * set up once, not worked with daily.
 */
export function WarehousesForm() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [isDefault, setIsDefault] = useState(false);

    const { data: warehouses } = useQuery({ queryKey: ['warehouses'], queryFn: fetchWarehouses });
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['warehouses'] });

    const close = () => {
        setOpen(false);
        setName('');
        setAddress('');
        setIsDefault(false);
    };

    const create = useMutation({
        mutationFn: () => createWarehouse({ name, address: address || null, is_default: isDefault, is_active: true }),
        meta: {
            successMessage: t('settings_page.warehouse_saved'),
            errorMessage: t('settings_page.warehouse_failed'),
        },
        onSuccess: () => {
            close();
            void refresh();
        },
    });

    const toggleActive = useMutation({
        mutationFn: (warehouse: WarehouseListItem) =>
            updateWarehouse(warehouse.id, { is_active: !warehouse.is_active }),
        meta: { successMessage: t('settings_page.warehouse_saved') },
        onSuccess: () => void refresh(),
    });

    const makeDefault = useMutation({
        mutationFn: (warehouse: WarehouseListItem) => updateWarehouse(warehouse.id, { is_default: true }),
        meta: { successMessage: t('settings_page.warehouse_saved') },
        onSuccess: () => void refresh(),
    });

    const remove = useMutation({
        mutationFn: (id: number) => deleteWarehouse(id),
        meta: {
            successMessage: t('settings_page.warehouse_deleted'),
            errorMessage: t('settings_page.warehouse_delete_failed'),
        },
        onSuccess: () => void refresh(),
    });

    return (
        <Paper sx={{ p: 3 }}>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 2 }}>
                <Box>
                    <Typography variant="h6" gutterBottom>
                        {t('settings_page.warehouses')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t('settings_page.warehouses_hint')}
                    </Typography>
                </Box>
                <AddButton label={t('settings_page.new_warehouse')} onClick={() => setOpen(true)} />
            </Stack>

            <TableContainer>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ '& th': { fontWeight: 700 } }}>
                            <TableCell>{t('fields.name')}</TableCell>
                            <TableCell>{t('parties.address')}</TableCell>
                            <TableCell align="center">{t('settings_page.default_warehouse')}</TableCell>
                            <TableCell align="center">{t('users_page.active')}</TableCell>
                            <TableCell />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {(warehouses ?? []).map((warehouse) => (
                            <TableRow key={warehouse.id} hover>
                                <TableCell sx={{ fontWeight: 600 }}>{warehouse.name}</TableCell>
                                <TableCell>{warehouse.address || '—'}</TableCell>
                                <TableCell align="center">
                                    {warehouse.is_default ? (
                                        <Chip size="small" color="primary" label={t('settings_page.default_warehouse')} />
                                    ) : (
                                        <LoadingButton
                                            size="small"
                                            loading={makeDefault.isPending && makeDefault.variables?.id === warehouse.id}
                                            onClick={() => makeDefault.mutate(warehouse)}
                                        >
                                            {t('settings_page.make_default')}
                                        </LoadingButton>
                                    )}
                                </TableCell>
                                <TableCell align="center">
                                    <Switch
                                        size="small"
                                        checked={warehouse.is_active}
                                        onChange={() => toggleActive.mutate(warehouse)}
                                    />
                                </TableCell>
                                <TableCell align="right">
                                    {/* The default is where stock lands when nothing else
                                        is chosen; removing it would leave the shop with
                                        nowhere to put anything. */}
                                    <Tooltip
                                        title={warehouse.is_default ? t('settings_page.cannot_delete_default') : t('actions.delete')}
                                    >
                                        <span>
                                            <IconButton
                                                size="small"
                                                color="error"
                                                disabled={warehouse.is_default}
                                                onClick={() => remove.mutate(warehouse.id)}
                                            >
                                                <DeleteOutlineIcon fontSize="small" />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                        ))}
                        {(warehouses ?? []).length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5}>
                                    <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                                        {t('reports_page.no_data')}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={open} onClose={close} fullWidth maxWidth="xs">
                <DialogTitle>{t('settings_page.new_warehouse')}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            label={t('fields.name')}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            fullWidth
                            autoFocus
                        />
                        <TextField
                            label={t('parties.address')}
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            fullWidth
                        />
                        <FormControlLabel
                            control={<Switch checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />}
                            label={t('settings_page.make_default')}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <LoadingButton onClick={close}>{t('actions.cancel')}</LoadingButton>
                    <LoadingButton
                        variant="contained"
                        loading={create.isPending}
                        disabled={name.trim() === ''}
                        onClick={() => create.mutate()}
                    >
                        {t('actions.save')}
                    </LoadingButton>
                </DialogActions>
            </Dialog>
        </Paper>
    );
}
