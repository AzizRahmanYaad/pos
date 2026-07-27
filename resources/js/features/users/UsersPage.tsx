import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Alert,
    Avatar,
    Box,
    Button,
    Checkbox,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    Grid,
    IconButton,
    InputAdornment,
    MenuItem,
    Paper,
    Stack,
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
import { alpha, useTheme } from '@mui/material/styles';
import GroupIcon from '@mui/icons-material/Group';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import { useTranslation } from 'react-i18next';
import { AddButton } from '@/components/AddButton';
import { LoadingButton } from '@/components/LoadingButton';
import {
    createUser,
    deleteUser,
    extendUserAccess,
    fetchPermissionCatalogue,
    fetchRoles,
    fetchTenants,
    fetchUsers,
    updateUser,
    type UserListItem,
    type UserPayload,
} from '@/features/users/api';
import { useAuthStore } from '@/store/authStore';
import { PermissionMatrix } from '@/features/users/PermissionMatrix';
import { CompanyLimitsPanel } from '@/features/users/CompanyLimitsPanel';
import { formatDate } from '@/lib/calendar';

const LOCALES = ['en', 'prs', 'ps'] as const;

const ROLE_CHIP_COLOR: Record<string, 'secondary' | 'primary' | 'info' | 'default'> = {
    superadmin: 'secondary',
    admin: 'primary',
    manager: 'info',
    cashier: 'default',
};

const SOON_THRESHOLD_DAYS = 30;

const STAFF_ROLES = ['manager', 'cashier'];

interface UserFormState {
    name: string;
    email: string;
    phone: string;
    address: string;
    logo: File | null;
    password: string;
    passwordConfirmation: string;
    locale: string;
    isActive: boolean;
    role: string;
    tenantId: number | '';
    permissions: string[];
    maxUsers: string;
}

const EMPTY_FORM: UserFormState = {
    name: '',
    email: '',
    phone: '',
    address: '',
    logo: null,
    password: '',
    passwordConfirmation: '',
    locale: 'en',
    isActive: true,
    role: '',
    tenantId: '',
    permissions: [],
    maxUsers: '',
};

function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();
}

function isExpired(user: UserListItem): boolean {
    return user.access_expires_at !== null && new Date(user.access_expires_at) < new Date();
}

function daysUntilExpiry(user: UserListItem): number | null {
    if (!user.access_expires_at) return null;
    return Math.ceil(
        (new Date(user.access_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
}

interface StatTileProps {
    icon: React.ReactNode;
    label: string;
    value: number;
}

function StatTile({ icon, label, value }: StatTileProps) {
    const theme = useTheme();

    return (
        <Paper
            variant="outlined"
            sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2, borderRadius: 2 }}
        >
            <Avatar
                variant="rounded"
                sx={{
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: 'primary.main',
                    width: 48,
                    height: 48,
                }}
            >
                {icon}
            </Avatar>
            <Box>
                <Typography variant="h5" fontWeight={700} lineHeight={1.2}>
                    {value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {label}
                </Typography>
            </Box>
        </Paper>
    );
}

export function UsersPage() {
    const { t, i18n } = useTranslation();
    const theme = useTheme();
    const queryClient = useQueryClient();
    const currentUser = useAuthStore((state) => state.user);
    const logoInputRef = useRef<HTMLInputElement | null>(null);

    const { data: usersPage } = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
    const users = usersPage?.users;
    const limit = usersPage?.limit ?? null;
    const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: fetchRoles });
    const canManageCompanies = useAuthStore((state) => state.can('companies.view'));
    const { data: tenants } = useQuery({
        queryKey: ['tenants'],
        queryFn: fetchTenants,
        enabled: canManageCompanies,
    });
    const { data: catalogue } = useQuery({ queryKey: ['permissions'], queryFn: fetchPermissionCatalogue });

    const [search, setSearch] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<UserListItem | null>(null);
    const [deleting, setDeleting] = useState<UserListItem | null>(null);
    const [extending, setExtending] = useState<UserListItem | null>(null);
    const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const filteredUsers = useMemo(() => {
        if (!users) return [];
        const query = search.trim().toLowerCase();
        if (!query) return users;
        return users.filter(
            (user) =>
                user.name.toLowerCase().includes(query) ||
                user.email.toLowerCase().includes(query) ||
                (user.phone ?? '').toLowerCase().includes(query) ||
                (user.address ?? '').toLowerCase().includes(query),
        );
    }, [users, search]);

    // A business that has used its allowance cannot add another account —
    // block it here as well as on the server, so the dialog never opens
    // only to fail on save.
    const limitReached = limit?.reached ?? false;

    const activeCount = users?.filter((user: UserListItem) => user.is_active).length ?? 0;
    const expiredCount = users?.filter(isExpired).length ?? 0;

    const set = <K extends keyof UserFormState>(key: K, value: UserFormState[K]) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    const closeDialog = () => {
        setDialogOpen(false);
        setEditing(null);
        setForm(EMPTY_FORM);
        setLogoPreview(null);
        setError(null);
    };

    const openCreate = () => {
        setEditing(null);
        setForm(EMPTY_FORM);
        setLogoPreview(null);
        setError(null);
        setDialogOpen(true);
    };

    const openEdit = (user: UserListItem) => {
        setEditing(user);
        setForm({
            name: user.name,
            email: user.email,
            phone: user.phone ?? '',
            address: user.address ?? '',
            logo: null,
            password: '',
            passwordConfirmation: '',
            locale: user.locale,
            isActive: user.is_active,
            role: user.roles[0] ?? '',
            tenantId: user.tenant_id ?? '',
            permissions: user.direct_permissions ?? [],
            maxUsers: '',
        });
        setLogoPreview(user.logo_url);
        setError(null);
        setDialogOpen(true);
    };

    const pickLogo = (file: File | null) => {
        set('logo', file);
        setLogoPreview(file ? URL.createObjectURL(file) : (editing?.logo_url ?? null));
    };

    const saveMutation = useMutation({
        mutationFn: () => {
            const editingSelf = editing !== null && editing.id === currentUser?.id;
            const payload: UserPayload = {
                name: form.name,
                email: form.email,
                phone: form.phone || undefined,
                address: form.address || undefined,
                logo: form.logo,
                locale: form.locale,
                // Own roles/status cannot be changed — the backend rejects it.
                // Staff created by a shop are cashiers as far as the role
                // system is concerned; what they may actually do comes from
                // the permissions ticked below, not from this word.
                ...(editingSelf ? {} : { is_active: form.isActive, roles: [form.role || 'cashier'] }),
                ...(STAFF_ROLES.includes(form.role) && form.tenantId !== ''
                    ? { tenant_id: form.tenantId }
                    : {}),
                ...(editingSelf ? {} : { permissions: form.permissions }),
                ...(canManageCompanies && form.role === 'admin' && form.maxUsers !== ''
                    ? { max_users: Number(form.maxUsers) }
                    : {}),
                ...(form.password
                    ? { password: form.password, password_confirmation: form.passwordConfirmation }
                    : {}),
            };

            return editing ? updateUser(editing.id, payload) : createUser(payload);
        },
        meta: { successMessage: editing ? t('users_page.update_success') : t('users_page.create_success') },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            closeDialog();
        },
        onError: () => setError(t('users_page.save_failed')),
    });

    const deleteMutation = useMutation({
        mutationFn: (user: UserListItem) => deleteUser(user.id),
        meta: {
            successMessage: t('users_page.delete_success'),
            errorMessage: t('users_page.delete_failed'),
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setDeleting(null);
        },
        onError: () => setDeleting(null),
    });

    const extendMutation = useMutation({
        mutationFn: (user: UserListItem) => extendUserAccess(user.id),
        meta: {
            successMessage: t('users_page.extend_success'),
            errorMessage: t('users_page.extend_failed'),
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setExtending(null);
        },
        onError: () => setExtending(null),
    });

    const isSelf = (user: UserListItem) => user.id === currentUser?.id;

    const passwordsMismatch =
        (form.password !== '' || !editing) && form.password !== form.passwordConfirmation;

    const canSave =
        form.name !== '' &&
        form.email !== '' &&
        // A Company Admin is not shown the role field, so it cannot be a
        // requirement for them; their staff are described by permissions.
        (canManageCompanies ? form.role !== '' : true) &&
        // Only the platform owner chooses which business a staff account
        // joins, so only they have a business to pick. For a Company Admin
        // the field is not shown at all — the backend takes their own.
        (canManageCompanies && STAFF_ROLES.includes(form.role) ? form.tenantId !== '' : true) &&
        (editing ? true : form.password !== '') &&
        !passwordsMismatch;

    const renderExpiry = (user: UserListItem) => {
        if (!user.access_expires_at) {
            return (
                <Typography variant="body2" color="text.secondary">
                    {t('users_page.no_expiry')}
                </Typography>
            );
        }

        if (isExpired(user)) {
            return (
                <Chip
                    size="small"
                    color="error"
                    icon={<EventBusyIcon />}
                    label={t('users_page.expired')}
                />
            );
        }

        const days = daysUntilExpiry(user) ?? 0;
        const date = formatDate(user.access_expires_at, i18n.language);

        return days <= SOON_THRESHOLD_DAYS ? (
            <Chip size="small" color="warning" icon={<EventBusyIcon />} label={date} />
        ) : (
            <Typography variant="body2">{date}</Typography>
        );
    };

    return (
        <Box>
            <Box
                sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 2,
                    mb: 3,
                }}
            >
                <Box>
                    <Typography variant="h4" fontWeight={700}>
                        {t('users_page.title')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {t('users_page.subtitle')}
                    </Typography>
                </Box>
                {/* When the allowance is spent the tooltip has to say so —
                    that reason matters more than the button's own name. */}
                <AddButton
                    label={
                        limitReached
                            ? t('users_page.limit.reached', { max: limit?.max_users })
                            : t('users_page.new_user')
                    }
                    icon={<PersonAddAlt1Icon sx={{ fontSize: 18 }} />}
                    onClick={openCreate}
                    disabled={limitReached}
                />
            </Box>

            {canManageCompanies && <CompanyLimitsPanel />}

            {/* Say where the business stands before they hit the ceiling,
                and say plainly what to do about it once they have. */}
            {limit !== null && limit.max_users !== null && (
                <Alert
                    severity={limitReached ? 'warning' : 'info'}
                    icon={<GroupIcon fontSize="inherit" />}
                    sx={{ mb: 3 }}
                >
                    {limitReached
                        ? t('users_page.limit.reached', { max: limit.max_users })
                        : `${t('users_page.limit.usage', { used: limit.user_count, max: limit.max_users })} · ${t('users_page.limit.remaining', { count: limit.remaining ?? 0 })}`}
                </Alert>
            )}

            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} md={3}>
                    <StatTile
                        icon={<GroupIcon />}
                        label={t('users_page.total_users')}
                        value={users?.length ?? 0}
                    />
                </Grid>
                <Grid item xs={6} md={3}>
                    <StatTile
                        icon={<HowToRegIcon />}
                        label={t('users_page.active_users')}
                        value={activeCount}
                    />
                </Grid>
                <Grid item xs={6} md={3}>
                    <StatTile
                        icon={<PersonOffIcon />}
                        label={t('users_page.inactive_users')}
                        value={(users?.length ?? 0) - activeCount}
                    />
                </Grid>
                <Grid item xs={6} md={3}>
                    <StatTile
                        icon={<EventBusyIcon />}
                        label={t('users_page.expired_users')}
                        value={expiredCount}
                    />
                </Grid>
            </Grid>

            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                <Box sx={{ p: 2 }}>
                    <TextField
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('actions.search')}
                        size="small"
                        fullWidth
                        sx={{ maxWidth: 360 }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" />
                                </InputAdornment>
                            ),
                        }}
                    />
                </Box>
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                                <TableCell>{t('fields.name')}</TableCell>
                                <TableCell>{t('fields.phone')}</TableCell>
                                {/* Roles and the paid-access expiry are the
                                    platform owner's to set. A shop's own
                                    screen shows neither, so nothing on it
                                    invites a decision that is not theirs. */}
                                {canManageCompanies && <TableCell>{t('users_page.role')}</TableCell>}
                                {canManageCompanies && <TableCell>{t('users_page.expires')}</TableCell>}
                                <TableCell>{t('fields.status')}</TableCell>
                                <TableCell align="right"> </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredUsers.map((user) => (
                                <TableRow key={user.id} hover>
                                    <TableCell>
                                        <Stack direction="row" spacing={1.5} alignItems="center">
                                            <Avatar
                                                src={user.logo_url ?? undefined}
                                                sx={{
                                                    width: 36,
                                                    height: 36,
                                                    fontSize: 14,
                                                    bgcolor: user.roles.includes('superadmin')
                                                        ? alpha(theme.palette.secondary.main, 0.9)
                                                        : alpha(theme.palette.primary.main, 0.9),
                                                }}
                                            >
                                                {initials(user.name)}
                                            </Avatar>
                                            <Box>
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    <Typography variant="body2" fontWeight={600}>
                                                        {user.name}
                                                    </Typography>
                                                    {isSelf(user) && (
                                                        <Chip
                                                            size="small"
                                                            variant="outlined"
                                                            label={t('users_page.you')}
                                                        />
                                                    )}
                                                </Stack>
                                                <Typography variant="caption" color="text.secondary">
                                                    {user.email}
                                                    {user.address ? ` · ${user.address}` : ''}
                                                </Typography>
                                            </Box>
                                        </Stack>
                                    </TableCell>
                                    <TableCell>{user.phone ?? '—'}</TableCell>
                                    {canManageCompanies && (
                                    <TableCell>
                                        {user.roles.map((role) => (
                                            <Chip
                                                key={role}
                                                size="small"
                                                color={ROLE_CHIP_COLOR[role] ?? 'default'}
                                                variant={
                                                    (ROLE_CHIP_COLOR[role] ?? 'default') === 'default'
                                                        ? 'outlined'
                                                        : 'filled'
                                                }
                                                label={t(`users_page.roles.${role}`, {
                                                    defaultValue: role,
                                                })}
                                                sx={{ mr: 0.5 }}
                                            />
                                        ))}
                                        {user.tenant_name && (
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                display="block"
                                                sx={{ mt: 0.25 }}
                                            >
                                                {user.tenant_name}
                                            </Typography>
                                        )}
                                    </TableCell>
                                    )}
                                    {canManageCompanies && <TableCell>{renderExpiry(user)}</TableCell>}
                                    <TableCell>
                                        <Chip
                                            size="small"
                                            icon={
                                                user.is_active ? (
                                                    <HowToRegIcon />
                                                ) : (
                                                    <PersonOffIcon />
                                                )
                                            }
                                            color={user.is_active ? 'success' : 'default'}
                                            variant={user.is_active ? 'filled' : 'outlined'}
                                            label={
                                                user.is_active
                                                    ? t('users_page.active')
                                                    : t('users_page.inactive')
                                            }
                                        />
                                    </TableCell>
                                    <TableCell align="right">
                                        {canManageCompanies && !user.roles.includes('superadmin') && (
                                            <Tooltip title={t('users_page.extend')}>
                                                <IconButton
                                                    size="small"
                                                    color="primary"
                                                    onClick={() => setExtending(user)}
                                                >
                                                    <EventRepeatIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                        <Tooltip title={t('actions.edit')}>
                                            <IconButton size="small" onClick={() => openEdit(user)}>
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        {!isSelf(user) && (
                                            <Tooltip title={t('actions.delete')}>
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={() => setDeleting(user)}
                                                >
                                                    <DeleteOutlineIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {users && filteredUsers.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6}>
                                        <Box sx={{ py: 6, textAlign: 'center' }}>
                                            <GroupIcon
                                                sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }}
                                            />
                                            <Typography color="text.secondary">
                                                {t('users_page.no_users_found')}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
                <DialogTitle>
                    {editing ? t('users_page.edit_user') : t('users_page.new_user')}
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        {error && <Alert severity="error">{error}</Alert>}
                        {!editing && <Alert severity="info">{t('users_page.one_year_note')}</Alert>}
                        <Stack direction="row" spacing={2} alignItems="center">
                            <Avatar
                                src={logoPreview ?? undefined}
                                variant="rounded"
                                sx={{ width: 64, height: 64 }}
                            >
                                <AddPhotoAlternateIcon />
                            </Avatar>
                            <Button
                                variant="outlined"
                                startIcon={<AddPhotoAlternateIcon />}
                                onClick={() => logoInputRef.current?.click()}
                            >
                                {t('users_page.upload_logo')}
                            </Button>
                            <input
                                ref={logoInputRef}
                                type="file"
                                accept="image/*"
                                hidden
                                onChange={(e) => pickLogo(e.target.files?.[0] ?? null)}
                            />
                        </Stack>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label={t('fields.name')}
                                    value={form.name}
                                    onChange={(e) => set('name', e.target.value)}
                                    fullWidth
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label={t('auth.email')}
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => set('email', e.target.value)}
                                    fullWidth
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label={t('fields.phone')}
                                    value={form.phone}
                                    onChange={(e) => set('phone', e.target.value)}
                                    fullWidth
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label={t('users_page.address')}
                                    value={form.address}
                                    onChange={(e) => set('address', e.target.value)}
                                    fullWidth
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    select
                                    label={t('common.language')}
                                    value={form.locale}
                                    onChange={(e) => set('locale', e.target.value)}
                                    fullWidth
                                >
                                    {LOCALES.map((locale) => (
                                        <MenuItem key={locale} value={locale}>
                                            {t(`users_page.locales.${locale}`)}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Grid>
                            {/* Roles belong to the platform owner. What a
                                shop's own staff may do is decided by the
                                permission matrix below, which is the real
                                control — a role on top of it was a second
                                answer to the same question. */}
                            {canManageCompanies && (
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    select
                                    label={t('users_page.role')}
                                    value={form.role}
                                    onChange={(e) => set('role', e.target.value)}
                                    disabled={editing !== null && isSelf(editing)}
                                    helperText={
                                        form.role === 'admin' ? t('users_page.admin_founds_business') : undefined
                                    }
                                    fullWidth
                                >
                                    {roles?.map((role) => (
                                        <MenuItem key={role.name} value={role.name}>
                                            {t(`users_page.roles.${role.name}`, {
                                                defaultValue: role.name,
                                            })}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Grid>
                            )}
                            {canManageCompanies && form.role === 'admin' && editing === null && (
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        label={t('users_page.limit.max_users')}
                                        type="number"
                                        value={form.maxUsers}
                                        onChange={(e) => set('maxUsers', e.target.value)}
                                        helperText={t('users_page.limit.max_users_hint')}
                                        fullWidth
                                    />
                                </Grid>
                            )}
                            {canManageCompanies && STAFF_ROLES.includes(form.role) && (
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        select
                                        label={t('users_page.business')}
                                        value={form.tenantId}
                                        onChange={(e) =>
                                            set('tenantId', e.target.value === '' ? '' : Number(e.target.value))
                                        }
                                        helperText={t('users_page.business_hint')}
                                        fullWidth
                                    >
                                        {tenants?.map((tenant) => (
                                            <MenuItem key={tenant.id} value={tenant.id}>
                                                {tenant.name}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                </Grid>
                            )}
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label={
                                        editing
                                            ? t('users_page.new_password_optional')
                                            : t('auth.password')
                                    }
                                    type="password"
                                    value={form.password}
                                    onChange={(e) => set('password', e.target.value)}
                                    fullWidth
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label={t('users_page.confirm_password')}
                                    type="password"
                                    value={form.passwordConfirmation}
                                    onChange={(e) => set('passwordConfirmation', e.target.value)}
                                    error={passwordsMismatch && form.passwordConfirmation !== ''}
                                    fullWidth
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={form.isActive}
                                            disabled={editing !== null && isSelf(editing)}
                                            onChange={(e) => set('isActive', e.target.checked)}
                                        />
                                    }
                                    label={t('users_page.active')}
                                />
                            </Grid>

                            {/* Nobody edits their own access here — the
                                backend refuses it, so hide it rather than
                                offer a control that cannot work. */}
                            {catalogue && !(editing !== null && isSelf(editing)) && (
                                <Grid item xs={12}>
                                    <Divider sx={{ mb: 2 }} />
                                    <Typography variant="subtitle2" fontWeight={800}>
                                        {t('users_page.permissions.title')}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                                        {t('users_page.permissions.subtitle')}
                                    </Typography>
                                    <PermissionMatrix
                                        modules={catalogue.modules}
                                        presets={catalogue.presets}
                                        value={form.permissions}
                                        onChange={(permissions) => set('permissions', permissions)}
                                    />
                                </Grid>
                            )}
                        </Grid>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDialog}>{t('actions.cancel')}</Button>
                    <LoadingButton
                        variant="contained"
                        loading={saveMutation.isPending}
                        disabled={!canSave}
                        onClick={() => saveMutation.mutate()}
                    >
                        {t('actions.save')}
                    </LoadingButton>
                </DialogActions>
            </Dialog>

            <Dialog open={extending !== null} onClose={() => setExtending(null)} maxWidth="xs" fullWidth>
                <DialogTitle>{t('users_page.extend_title')}</DialogTitle>
                <DialogContent>
                    <Typography>{t('users_page.extend_confirm', { name: extending?.name })}</Typography>
                    {extending?.access_expires_at && !isExpired(extending) && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {t('users_page.expires')}:{' '}
                            {formatDate(extending.access_expires_at, i18n.language)}
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setExtending(null)}>{t('actions.cancel')}</Button>
                    <LoadingButton
                        variant="contained"
                        startIcon={<EventRepeatIcon />}
                        loading={extendMutation.isPending}
                        onClick={() => extending && extendMutation.mutate(extending)}
                    >
                        {t('users_page.extend')}
                    </LoadingButton>
                </DialogActions>
            </Dialog>

            <Dialog open={deleting !== null} onClose={() => setDeleting(null)} maxWidth="xs" fullWidth>
                <DialogTitle>{t('users_page.delete_user')}</DialogTitle>
                <DialogContent>
                    <Typography>{t('users_page.delete_confirm', { name: deleting?.name })}</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleting(null)}>{t('actions.cancel')}</Button>
                    <LoadingButton
                        variant="contained"
                        color="error"
                        loading={deleteMutation.isPending}
                        onClick={() => deleting && deleteMutation.mutate(deleting)}
                    >
                        {t('actions.delete')}
                    </LoadingButton>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
