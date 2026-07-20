import { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    TextField,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Stack,
    Chip,
    CircularProgress,
    Alert,
    Grid,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import LockResetIcon from '@mui/icons-material/LockReset';
import ExtensionIcon from '@mui/icons-material/Extension';
import superAdminAPI from './api';

export function SuperAdminDashboard() {
    const { t } = useTranslation();
    const [organizations, setOrganizations] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Modals
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [extendDialogOpen, setExtendDialogOpen] = useState(false);
    const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
    const [selectedOrg, setSelectedOrg] = useState(null);

    // Form states
    const [createFormData, setCreateFormData] = useState({
        name: '',
        address: '',
        phone: '',
        admin_name: '',
        admin_email: '',
        admin_password: '',
    });
    const [extendYears, setExtendYears] = useState(1);
    const [newPassword, setNewPassword] = useState('');

    useEffect(() => {
        loadOrganizations();
        loadStats();
    }, [page, search]);

    const loadOrganizations = async () => {
        setLoading(true);
        try {
            const response = await superAdminAPI.listOrganizations(page, search);
            setOrganizations(response.data.data || []);
            setError('');
        } catch (err) {
            setError('Failed to load organizations');
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            const response = await superAdminAPI.getSubscriptionStats();
            setStats(response.data);
        } catch (err) {
            console.error('Failed to load stats');
        }
    };

    const handleCreatePOS = async () => {
        if (!createFormData.name || !createFormData.admin_email || !createFormData.admin_password) {
            setError('Please fill in required fields');
            return;
        }

        setLoading(true);
        try {
            await superAdminAPI.createOrganization(createFormData);
            setSuccess('POS created successfully!');
            setCreateDialogOpen(false);
            setCreateFormData({
                name: '',
                address: '',
                phone: '',
                admin_name: '',
                admin_email: '',
                admin_password: '',
            });
            loadOrganizations();
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create POS');
        } finally {
            setLoading(false);
        }
    };

    const handleExtendSubscription = async () => {
        if (!selectedOrg || extendYears < 1) return;

        setLoading(true);
        try {
            await superAdminAPI.extendSubscription(selectedOrg.id, extendYears);
            setSuccess(`Subscription extended by ${extendYears} year(s)`);
            setExtendDialogOpen(false);
            loadOrganizations();
            setError('');
        } catch (err) {
            setError('Failed to extend subscription');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!selectedOrg || !newPassword) return;

        setLoading(true);
        try {
            const response = await superAdminAPI.resetAdminPassword(selectedOrg.id, newPassword);
            setSuccess('Password reset successfully!');
            setResetPasswordDialogOpen(false);
            setNewPassword('');
            loadOrganizations();
            setError('');
        } catch (err) {
            setError('Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    const getSubscriptionStatus = (expiresAt) => {
        const expirationDate = new Date(expiresAt);
        const now = new Date();
        const daysLeft = Math.floor((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysLeft < 0) {
            return { label: 'Expired', color: 'error' };
        } else if (daysLeft <= 30) {
            return { label: `Expiring Soon (${daysLeft} days)`, color: 'warning' };
        } else {
            return { label: `Active (${daysLeft} days)`, color: 'success' };
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    📊 Superadmin Dashboard
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setCreateDialogOpen(true)}
                    sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                >
                    Create POS
                </Button>
            </Box>

            {/* Statistics */}
            {stats && (
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={6} md={2.4}>
                        <Card sx={{ textAlign: 'center' }}>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Total POS
                                </Typography>
                                <Typography variant="h4">{stats.total_pos}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2.4}>
                        <Card sx={{ textAlign: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                            <CardContent>
                                <Typography gutterBottom>Active</Typography>
                                <Typography variant="h4">{stats.active_pos}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2.4}>
                        <Card sx={{ textAlign: 'center' }}>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Active Subscriptions
                                </Typography>
                                <Typography variant="h4">{stats.active_subscriptions}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2.4}>
                        <Card sx={{ textAlign: 'center', background: '#fff3cd' }}>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Expiring Soon
                                </Typography>
                                <Typography variant="h4" sx={{ color: '#ff9800' }}>{stats.expiring_soon}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2.4}>
                        <Card sx={{ textAlign: 'center', background: '#ffebee' }}>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Expired
                                </Typography>
                                <Typography variant="h4" sx={{ color: '#f44336' }}>{stats.expired_subscriptions}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}

            {/* Alerts */}
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

            {/* Search */}
            <TextField
                fullWidth
                placeholder="Search POS by name or slug..."
                value={search}
                onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                }}
                sx={{ mb: 3 }}
            />

            {/* Organizations Table */}
            <TableContainer component={Paper}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Table>
                        <TableHead sx={{ background: '#f5f5f5' }}>
                            <TableRow>
                                <TableCell><strong>POS Name</strong></TableCell>
                                <TableCell><strong>Admin Email</strong></TableCell>
                                <TableCell><strong>Subscription</strong></TableCell>
                                <TableCell><strong>Status</strong></TableCell>
                                <TableCell><strong>Actions</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {organizations.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                                        No POS found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                organizations.map((org) => {
                                    const subscriptionStatus = getSubscriptionStatus(org.subscription_expires_at);
                                    return (
                                        <TableRow key={org.id} hover>
                                            <TableCell>{org.name}</TableCell>
                                            <TableCell>{org.admin_user?.email}</TableCell>
                                            <TableCell>
                                                {new Date(org.subscription_expires_at).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={subscriptionStatus.label}
                                                    color={subscriptionStatus.color}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Stack direction="row" spacing={1}>
                                                    <Button
                                                        size="small"
                                                        startIcon={<ExtensionIcon />}
                                                        onClick={() => {
                                                            setSelectedOrg(org);
                                                            setExtendDialogOpen(true);
                                                        }}
                                                    >
                                                        Extend
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        startIcon={<LockResetIcon />}
                                                        onClick={() => {
                                                            setSelectedOrg(org);
                                                            setResetPasswordDialogOpen(true);
                                                        }}
                                                    >
                                                        Reset
                                                    </Button>
                                                </Stack>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                )}
            </TableContainer>

            {/* Create POS Dialog */}
            <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Create New POS</DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                    <Stack spacing={2}>
                        <TextField
                            fullWidth
                            label="POS Name"
                            value={createFormData.name}
                            onChange={(e) =>
                                setCreateFormData({ ...createFormData, name: e.target.value })
                            }
                        />
                        <TextField
                            fullWidth
                            label="Address"
                            multiline
                            rows={2}
                            value={createFormData.address}
                            onChange={(e) =>
                                setCreateFormData({ ...createFormData, address: e.target.value })
                            }
                        />
                        <TextField
                            fullWidth
                            label="Phone"
                            value={createFormData.phone}
                            onChange={(e) =>
                                setCreateFormData({ ...createFormData, phone: e.target.value })
                            }
                        />
                        <TextField
                            fullWidth
                            label="Admin Name"
                            value={createFormData.admin_name}
                            onChange={(e) =>
                                setCreateFormData({ ...createFormData, admin_name: e.target.value })
                            }
                        />
                        <TextField
                            fullWidth
                            label="Admin Email"
                            type="email"
                            value={createFormData.admin_email}
                            onChange={(e) =>
                                setCreateFormData({ ...createFormData, admin_email: e.target.value })
                            }
                        />
                        <TextField
                            fullWidth
                            label="Admin Password"
                            type="password"
                            value={createFormData.admin_password}
                            onChange={(e) =>
                                setCreateFormData({ ...createFormData, admin_password: e.target.value })
                            }
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                    <Button
                        onClick={handleCreatePOS}
                        variant="contained"
                        sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                    >
                        Create
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Extend Subscription Dialog */}
            <Dialog open={extendDialogOpen} onClose={() => setExtendDialogOpen(false)}>
                <DialogTitle>Extend Subscription</DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                    <Stack spacing={2}>
                        <Typography>Extend subscription for {selectedOrg?.name}</Typography>
                        <TextField
                            fullWidth
                            type="number"
                            label="Years"
                            value={extendYears}
                            onChange={(e) => setExtendYears(Math.max(1, parseInt(e.target.value) || 1))}
                            inputProps={{ min: 1, max: 10 }}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setExtendDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleExtendSubscription} variant="contained">
                        Extend
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Reset Password Dialog */}
            <Dialog open={resetPasswordDialogOpen} onClose={() => setResetPasswordDialogOpen(false)}>
                <DialogTitle>Reset Admin Password</DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                    <Stack spacing={2}>
                        <Typography>Reset password for {selectedOrg?.name} admin</Typography>
                        <TextField
                            fullWidth
                            type="password"
                            label="New Password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setResetPasswordDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleResetPassword} variant="contained">
                        Reset
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
