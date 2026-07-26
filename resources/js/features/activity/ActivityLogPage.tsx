import { Fragment, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
    Box,
    Chip,
    CircularProgress,
    Collapse,
    Grid,
    IconButton,
    MenuItem,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { useTranslation } from 'react-i18next';
import { Can } from '@/components/Can';
import { LoadingButton } from '@/components/LoadingButton';
import { downloadOrToast } from '@/lib/reportDownload';
import {
    downloadActivityCsv,
    fetchActivity,
    fetchActivityFilterOptions,
    type ActivityEntry,
} from '@/features/activity/api';

/** Colour carries the same meaning everywhere: green makes, amber changes, red removes. */
const EVENT_COLOR: Record<string, 'success' | 'info' | 'error' | 'warning' | 'default'> = {
    created: 'success',
    updated: 'info',
    deleted: 'error',
    denied: 'error',
    'sign-in-failed': 'error',
    'signed-in': 'success',
    'signed-out': 'default',
    exported: 'warning',
};

function EventChip({ event }: { event: string }) {
    const { t } = useTranslation();

    return (
        <Chip
            size="small"
            color={EVENT_COLOR[event] ?? 'default'}
            variant={EVENT_COLOR[event] === undefined ? 'outlined' : 'filled'}
            label={t(`activity_page.events.${event}`, event)}
            sx={{ fontWeight: 600 }}
        />
    );
}

function What({ entry }: { entry: ActivityEntry }) {
    const { t } = useTranslation();

    if (entry.subject_label) {
        return <Typography variant="body2">{entry.subject_label}</Typography>;
    }

    if (entry.path) {
        return (
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                {entry.method} {entry.path}
            </Typography>
        );
    }

    // Nothing more to say than the Action column already does — repeating
    // "Signed in" in both places just reads as a mistake.
    return (
        <Typography variant="body2" color="text.secondary">
            —
        </Typography>
    );
}

function ChangeDetail({ entry }: { entry: ActivityEntry }) {
    const { t } = useTranslation();
    const theme = useTheme();

    if (entry.changes.length === 0) {
        return (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1.5 }}>
                {t('activity_page.no_detail')}
            </Typography>
        );
    }

    return (
        <Box sx={{ py: 1.5 }}>
            <Table size="small" sx={{ maxWidth: 720 }}>
                <TableHead>
                    <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>{t('activity_page.field')}</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{t('activity_page.before')}</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{t('activity_page.after')}</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {entry.changes.map((change) => (
                        <TableRow key={change.field}>
                            <TableCell sx={{ fontWeight: 600 }}>{change.field}</TableCell>
                            <TableCell sx={{ color: theme.palette.text.secondary }}>
                                {change.from === null || change.from === '' ? '—' : String(change.from)}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                                {change.to === null || change.to === '' ? '—' : String(change.to)}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Box>
    );
}

function EntryRow({ entry }: { entry: ActivityEntry }) {
    const { t } = useTranslation();
    const theme = useTheme();
    const [open, setOpen] = useState(false);
    const expandable = entry.changes.length > 0;

    return (
        <Fragment>
            <TableRow hover sx={{ '& > *': { borderBottom: open ? 'none' : undefined } }}>
                <TableCell padding="checkbox">
                    {expandable && (
                        <IconButton size="small" onClick={() => setOpen((value) => !value)} aria-label={t('activity_page.details')}>
                            {open ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
                        </IconButton>
                    )}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Typography variant="body2" fontWeight={600}>
                        {new Date(entry.created_at).toLocaleString()}
                    </Typography>
                </TableCell>
                <TableCell>{entry.user_name ?? '—'}</TableCell>
                <TableCell>
                    <Chip
                        size="small"
                        variant="outlined"
                        label={t(`activity_page.modules.${entry.module}`, entry.module)}
                        sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06) }}
                    />
                </TableCell>
                <TableCell>
                    <EventChip event={entry.event} />
                </TableCell>
                <TableCell>
                    <What entry={entry} />
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Typography variant="caption" color="text.secondary">
                        {entry.ip_address ?? '—'}
                    </Typography>
                </TableCell>
            </TableRow>
            {expandable && (
                <TableRow>
                    <TableCell colSpan={7} sx={{ py: 0, bgcolor: alpha(theme.palette.primary.main, 0.03) }}>
                        <Collapse in={open} unmountOnExit>
                            <ChangeDetail entry={entry} />
                        </Collapse>
                    </TableCell>
                </TableRow>
            )}
        </Fragment>
    );
}

/**
 * The audit trail: who did what, when, and from where. Records that have
 * since been deleted still read correctly, because each entry keeps the
 * name the record had at the time.
 */
export function ActivityLogPage() {
    const { t } = useTranslation();

    const [userId, setUserId] = useState<number | ''>('');
    const [module, setModule] = useState('');
    const [event, setEvent] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const [perPage, setPerPage] = useState(25);
    const [exporting, setExporting] = useState(false);

    const filters = { userId, module, event, from, to, search };
    const query = { ...filters, page: page + 1, perPage };

    const { data, isLoading } = useQuery({
        queryKey: ['activity-log', query],
        queryFn: () => fetchActivity(query),
        placeholderData: keepPreviousData,
    });

    const { data: options } = useQuery({
        queryKey: ['activity-log', 'filters'],
        queryFn: fetchActivityFilterOptions,
    });

    // Any filter change re-reads from the first page; staying on page 7 of a
    // result set that now has two pages just shows an empty table.
    const onFilterChange = <T,>(setter: (value: T) => void) => (value: T) => {
        setter(value);
        setPage(0);
    };

    const exportCsv = async () => {
        setExporting(true);
        await downloadOrToast(() => downloadActivityCsv(filters));
        setExporting(false);
    };

    return (
        <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} mb={2}>
                <Box>
                    <Typography variant="h5" fontWeight={800}>
                        {t('activity_page.title')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t('activity_page.subtitle')}
                    </Typography>
                </Box>
                <Can permission="activity.export">
                    <LoadingButton
                        variant="outlined"
                        startIcon={<FileDownloadOutlinedIcon />}
                        loading={exporting}
                        onClick={exportCsv}
                    >
                        {t('activity_page.export_csv')}
                    </LoadingButton>
                </Can>
            </Stack>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 2 }}>
                <Grid container spacing={1.5}>
                    <Grid item xs={12} sm={6} md={2.5}>
                        <TextField
                            select
                            fullWidth
                            size="small"
                            label={t('activity_page.user')}
                            value={userId}
                            onChange={(e) => onFilterChange(setUserId)(e.target.value === '' ? '' : Number(e.target.value))}
                        >
                            <MenuItem value="">{t('activity_page.all_users')}</MenuItem>
                            {(options?.users ?? []).map((user) => (
                                <MenuItem key={user.id} value={user.id}>
                                    {user.name}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                        <TextField
                            select
                            fullWidth
                            size="small"
                            label={t('activity_page.module')}
                            value={module}
                            onChange={(e) => onFilterChange(setModule)(e.target.value)}
                        >
                            <MenuItem value="">{t('activity_page.all_modules')}</MenuItem>
                            {(options?.modules ?? []).map((name) => (
                                <MenuItem key={name} value={name}>
                                    {t(`activity_page.modules.${name}`, name)}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                        <TextField
                            select
                            fullWidth
                            size="small"
                            label={t('activity_page.action')}
                            value={event}
                            onChange={(e) => onFilterChange(setEvent)(e.target.value)}
                        >
                            <MenuItem value="">{t('activity_page.all_actions')}</MenuItem>
                            {(options?.events ?? []).map((name) => (
                                <MenuItem key={name} value={name}>
                                    {t(`activity_page.events.${name}`, name)}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Grid>
                    <Grid item xs={6} sm={3} md={1.75}>
                        <TextField
                            type="date"
                            fullWidth
                            size="small"
                            label={t('activity_page.from')}
                            value={from}
                            onChange={(e) => onFilterChange(setFrom)(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Grid>
                    <Grid item xs={6} sm={3} md={1.75}>
                        <TextField
                            type="date"
                            fullWidth
                            size="small"
                            label={t('activity_page.to')}
                            value={to}
                            onChange={(e) => onFilterChange(setTo)(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Grid>
                    <Grid item xs={12} md={2}>
                        <TextField
                            fullWidth
                            size="small"
                            label={t('activity_page.search')}
                            value={search}
                            onChange={(e) => onFilterChange(setSearch)(e.target.value)}
                        />
                    </Grid>
                </Grid>
            </Paper>

            <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell padding="checkbox" />
                                <TableCell sx={{ fontWeight: 700 }}>{t('activity_page.when')}</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>{t('activity_page.user')}</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>{t('activity_page.module')}</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>{t('activity_page.action')}</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>{t('activity_page.record')}</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>
                                    <Tooltip title={t('activity_page.ip_hint')}>
                                        <span>{t('activity_page.ip')}</span>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                                        <CircularProgress size={28} />
                                    </TableCell>
                                </TableRow>
                            )}
                            {!isLoading && (data?.data.length ?? 0) === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                                        <Typography color="text.secondary">{t('activity_page.empty')}</Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                            {(data?.data ?? []).map((entry) => (
                                <EntryRow key={entry.id} entry={entry} />
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
                <TablePagination
                    component="div"
                    count={data?.total ?? 0}
                    page={page}
                    onPageChange={(_, next) => setPage(next)}
                    rowsPerPage={perPage}
                    rowsPerPageOptions={[25, 50, 100]}
                    onRowsPerPageChange={(e) => {
                        setPerPage(Number(e.target.value));
                        setPage(0);
                    }}
                />
            </Paper>
        </Box>
    );
}
