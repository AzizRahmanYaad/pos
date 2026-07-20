import { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    AppBar,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Grid,
    IconButton,
    Pagination,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Toolbar,
    Tooltip,
    Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LogoutIcon from '@mui/icons-material/Logout';
import LockResetIcon from '@mui/icons-material/LockReset';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import StorefrontIcon from '@mui/icons-material/Storefront';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useAuthStore } from '@/store/authStore';
import {
    createOrganization,
    extendSubscription,
    getSubscriptionStats,
    listOrganizations,
    resetAdminPassword,
    toggleOrganization,
    type AdminCredentials,
    type Organization,
    type SubscriptionStats,
} from './api';

const EMPTY_FORM = {
    name: '',
    address: '',
    phone: '',
    admin_name: '',
    admin_email: '',
    admin_password: '',
};

function extractErrorMessage(err: unknown, fallback: string): string {
    const response = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response;
    if (response?.data?.errors) {
        return Object.values(response.data.errors).flat().join(' ');
    }
    return response?.data?.message ?? fallback;
}

export function SuperAdminDashboard() {
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);

    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [stats, setStats] = useState<SubscriptionStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [extendDialogOpen, setExtendDialogOpen] = useState(false);
    const [resetDialogOpen, setResetDialogOpen] = useState(false);
    const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
    const [credentials, setCredentials] = useState<AdminCredentials | null>(null);

    const [form, setForm] = useState(EMPTY_FORM);
    const [extendYears, setExtendYears] = useState(1);
    const [newPassword, setNewPassword] = useState('');

    const loadOrganizations = useCallback(async () => {
        setLoading(true);
        try {
            const response = await listOrganizations(page, search);
            setOrganizations(response.data);
            setTotalPages(Math.max(1, Math.ceil(response.pagination.total / response.pagination.per_page)));
            setError('');
        } catch (err) {
            setError(extractErrorMessage(err, 'Failed to load POS list'));
        } finally {
            setLoading(false);
        }
    }, [page, search]);

    const loadStats = useCallback(async () => {
        try {
            setStats(await getSubscriptionStats());
        } catch {
            // stats are non-critical; table remains usable without them
        }
    }, []);

    useEffect(() => {
        loadOrganizations();
    }, [loadOrganizations]);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    const refresh = () => {
        loadOrganizations();
        loadStats();
    };

    const handleCreate = async () => {
        if (!form.name || !form.admin_name || !form.admin_email || !form.admin_password) {
            setError('Please fill in POS name, admin name, admin email and admin password');
            return;
        }
        setSubmitting(true);
        try {
            const response = await createOrganization({
                name: form.name,
                address: form.address || undefined,
                phone: form.phone || undefined,
                admin_name: form.admin_name,
                admin_email: form.admin_email,
                admin_password: form.admin_password,
            });
            setCreateDialogOpen(false);
            setForm(EMPTY_FORM);
            setCredentials(response.admin_credentials);
            setSuccess(`POS "${response.organization.name}" created successfully`);
            setError('');
            refresh();
        } catch (err) {
            setError(extractErrorMessage(err, 'Failed to create POS'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggle = async (org: Organization) => {
        setSubmitting(true);
        try {
            const response = await toggleOrganization(org.id);
            setSuccess(response.message);
            setError('');
            refresh();
        } catch (err) {
            setError(extractErrorMessage(err, 'Failed to update POS status'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleExtend = async () => {
        if (!selectedOrg) return;
        setSubmitting(true);
        try {
            const response = await extendSubscription(selectedOrg.id, extendYears);
            setExtendDialogOpen(false);
            setSuccess(response.message);
            setError('');
            refresh();
        } catch (err) {
            setError(extractErrorMessage(err, 'Failed to extend subscription'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleResetPassword = async () => {
        if (!selectedOrg || newPassword.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        setSubmitting(true);
        try {
            await resetAdminPassword(selectedOrg.id, newPassword);
            setResetDialogOpen(false);
            setCredentials({
                email: selectedOrg.admin_user?.email ?? '',
                password: newPassword,
                note: 'Password has been reset. Share it with the POS admin securely.',
            });
            setNewPassword('');
            setSuccess(`Password reset for ${selectedOrg.name}`);
            setError('');
        } catch (err) {
            setError(extractErrorMessage(err, 'Failed to reset password'));
        } finally {
            setSubmitting(false);
        }
    };

    const subscriptionStatus = (expiresAt: string) => {
        const daysLeft = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
        if (daysLeft < 0) return { label: 'Expired', color: 'error' as const };
        if (daysLeft <= 30) return { label: `${daysLeft} days left`, color: 'warning' as const };
        return { label: `Active · ${daysLeft} days`, color: 'success' as const };
    };

    const statCards: { label: string; value: number | undefined }[] = [
        { label: 'Total POS', value: stats?.total_pos },
        { label: 'Active POS', value: stats?.active_pos },
        { label: 'Active Subscriptions', value: stats?.active_subscriptions },
        { label: 'Expiring Soon', value: stats?.expiring_soon },
        { label: 'Expired', value: stats?.expired_subscriptions },
    ];

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#f4f5fa' }}>
            <AppBar position="static" sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                <Toolbar sx={{ gap: 2 }}>
                    <StorefrontIcon />
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        Super Admin — POS Management
                    </Typography>
                    {user && (
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                            {user.name}
                        </Typography>
                    )}
                    <Tooltip title="Logout">
                        <IconButton color="inherit" onClick={() => logout()}>
                            <LogoutIcon />
                        </IconButton>
                    </Tooltip>
                </Toolbar>
            </AppBar>

            <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    {statCards.map((card) => (
                        <Grid item xs={6} sm={4} md={2.4} key={card.label}>
                            <Card sx={{ textAlign: 'center', height: '100%' }}>
                                <CardContent>
                                    <Typography variant="body2" color="text.secondary" gutterBottom>
                                        {card.label}
                                    </Typography>
                                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                                        {card.value ?? '—'}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                        {error}
                    </Alert>
                )}
                {success && (
                    <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
                        {success}
                    </Alert>
                )}

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Search POS by name..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                    />
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setCreateDialogOpen(true)}
                        sx={{ whiteSpace: 'nowrap', px: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                    >
                        Create POS
                    </Button>
                </Stack>

                <TableContainer component={Paper}>
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <Table>
                            <TableHead sx={{ bgcolor: '#fafafa' }}>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 700 }}>POS Name</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Admin</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Subscription</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {organizations.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                                            No POS instances yet. Click "Create POS" to add the first one.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    organizations.map((org) => {
                                        const sub = subscriptionStatus(org.subscription_expires_at);
                                        return (
                                            <TableRow key={org.id} hover>
                                                <TableCell>
                                                    <Typography sx={{ fontWeight: 600 }}>{org.name}</Typography>
                                                    {org.phone && (
                                                        <Typography variant="caption" color="text.secondary">
                                                            {org.phone}
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2">{org.admin_user?.name}</Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {org.admin_user?.email}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip label={sub.label} color={sub.color} size="small" sx={{ mb: 0.5 }} />
                                                    <Typography variant="caption" display="block" color="text.secondary">
                                                        until {new Date(org.subscription_expires_at).toLocaleDateString()}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={org.is_active ? 'Enabled' : 'Disabled'}
                                                        color={org.is_active ? 'success' : 'default'}
                                                        size="small"
                                                        variant={org.is_active ? 'filled' : 'outlined'}
                                                    />
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Tooltip title="Extend subscription">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => {
                                                                setSelectedOrg(org);
                                                                setExtendYears(1);
                                                                setExtendDialogOpen(true);
                                                            }}
                                                        >
                                                            <EventRepeatIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Reset admin password">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => {
                                                                setSelectedOrg(org);
                                                                setNewPassword('');
                                                                setResetDialogOpen(true);
                                                            }}
                                                        >
                                                            <LockResetIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title={org.is_active ? 'Disable POS' : 'Enable POS'}>
                                                        <IconButton
                                                            size="small"
                                                            color={org.is_active ? 'error' : 'success'}
                                                            disabled={submitting}
                                                            onClick={() => handleToggle(org)}
                                                        >
                                                            <PowerSettingsNewIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    )}
                </TableContainer>

                {totalPages > 1 && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                        <Pagination count={totalPages} page={page} onChange={(_, value) => setPage(value)} />
                    </Box>
                )}
            </Box>

            {/* Create POS dialog */}
            <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Create New POS</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            label="POS Name"
                            required
                            fullWidth
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                        />
                        <TextField
                            label="Address"
                            fullWidth
                            multiline
                            rows={2}
                            value={form.address}
                            onChange={(e) => setForm({ ...form, address: e.target.value })}
                        />
                        <TextField
                            label="Phone"
                            fullWidth
                            value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        />
                        <TextField
                            label="Admin Name"
                            required
                            fullWidth
                            value={form.admin_name}
                            onChange={(e) => setForm({ ...form, admin_name: e.target.value })}
                        />
                        <TextField
                            label="Admin Email"
                            required
                            type="email"
                            fullWidth
                            value={form.admin_email}
                            onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
                        />
                        <TextField
                            label="Admin Password"
                            required
                            type="password"
                            fullWidth
                            helperText="Minimum 8 characters"
                            value={form.admin_password}
                            onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleCreate}
                        disabled={submitting}
                        startIcon={submitting ? <CircularProgress size={16} /> : <AddIcon />}
                    >
                        Create
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Extend subscription dialog */}
            <Dialog open={extendDialogOpen} onClose={() => setExtendDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Extend Subscription</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ mb: 2 }}>
                        Extend the subscription for <strong>{selectedOrg?.name}</strong>.
                    </DialogContentText>
                    <TextField
                        label="Years"
                        type="number"
                        fullWidth
                        value={extendYears}
                        onChange={(e) => setExtendYears(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                        inputProps={{ min: 1, max: 10 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setExtendDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleExtend} disabled={submitting}>
                        Extend
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Reset password dialog */}
            <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Reset Admin Password</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ mb: 2 }}>
                        Set a new password for the admin of <strong>{selectedOrg?.name}</strong> (
                        {selectedOrg?.admin_user?.email}).
                    </DialogContentText>
                    <TextField
                        label="New Password"
                        type="password"
                        fullWidth
                        helperText="Minimum 8 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setResetDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleResetPassword} disabled={submitting}>
                        Reset
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Credentials dialog — shown after create / password reset */}
            <Dialog open={credentials !== null} onClose={() => setCredentials(null)} maxWidth="xs" fullWidth>
                <DialogTitle>POS Admin Credentials</DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        Save these credentials now — the password will not be shown again.
                    </Alert>
                    <Stack spacing={1}>
                        <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ flexGrow: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                    Email
                                </Typography>
                                <Typography sx={{ fontFamily: 'monospace' }}>{credentials?.email}</Typography>
                            </Box>
                            <IconButton size="small" onClick={() => navigator.clipboard.writeText(credentials?.email ?? '')}>
                                <ContentCopyIcon fontSize="small" />
                            </IconButton>
                        </Paper>
                        <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ flexGrow: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                    Password
                                </Typography>
                                <Typography sx={{ fontFamily: 'monospace' }}>{credentials?.password}</Typography>
                            </Box>
                            <IconButton size="small" onClick={() => navigator.clipboard.writeText(credentials?.password ?? '')}>
                                <ContentCopyIcon fontSize="small" />
                            </IconButton>
                        </Paper>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button variant="contained" onClick={() => setCredentials(null)}>
                        Done
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
