import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Box,
    Grid,
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
    Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { fetchProfitLoss, fetchInventoryValuation } from '@/features/reports/api';
import { formatDate } from '@/lib/calendar';

function startOfMonth(): string {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
}

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

export function ReportsPage() {
    const { t, i18n } = useTranslation();
    const [from, setFrom] = useState(startOfMonth());
    const [to, setTo] = useState(today());
    const [tab, setTab] = useState<'profit-loss' | 'inventory'>('profit-loss');

    const { data: pnl } = useQuery({
        queryKey: ['report-pnl', from, to],
        queryFn: () => fetchProfitLoss(from, to),
        enabled: tab === 'profit-loss',
    });

    const { data: valuation } = useQuery({
        queryKey: ['report-inventory-valuation'],
        queryFn: fetchInventoryValuation,
        enabled: tab === 'inventory',
    });

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                {t('nav.reports')}
            </Typography>

            <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                <TextField
                    select
                    label={t('reports_page.report_label')}
                    value={tab}
                    onChange={(e) => setTab(e.target.value as typeof tab)}
                    sx={{ minWidth: 220 }}
                >
                    <MenuItem value="profit-loss">{t('reports_page.profit_loss')}</MenuItem>
                    <MenuItem value="inventory">{t('reports_page.inventory_valuation')}</MenuItem>
                </TextField>
                {tab === 'profit-loss' && (
                    <>
                        <TextField
                            label={t('fields.from')}
                            type="date"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                        />
                        <TextField
                            label={t('fields.to')}
                            type="date"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                        />
                    </>
                )}
            </Stack>

            {tab === 'profit-loss' && pnl && (
                <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="subtitle1" gutterBottom component="div" dir="ltr">
                                {formatDate(pnl.from, i18n.language)} — {formatDate(pnl.to, i18n.language)}
                            </Typography>
                            <Table size="small">
                                <TableBody>
                                    <TableRow>
                                        <TableCell>{t('fields.revenue')}</TableCell>
                                        <TableCell align="right">{pnl.revenue.toFixed(2)}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell>{t('fields.cogs')}</TableCell>
                                        <TableCell align="right">-{pnl.cogs.toFixed(2)}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell><strong>{t('fields.gross_profit')}</strong></TableCell>
                                        <TableCell align="right"><strong>{pnl.gross_profit.toFixed(2)}</strong></TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell>{t('fields.operating_expenses')}</TableCell>
                                        <TableCell align="right">-{pnl.operating_expenses.toFixed(2)}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell>{t('fields.payroll_cost')}</TableCell>
                                        <TableCell align="right">-{pnl.payroll_cost.toFixed(2)}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell><strong>{t('fields.net_profit')}</strong></TableCell>
                                        <TableCell align="right">
                                            <strong>{pnl.net_profit.toFixed(2)}</strong>
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </Paper>
                    </Grid>
                </Grid>
            )}

            {tab === 'inventory' && valuation && (
                <Paper sx={{ p: 2 }}>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('fields.sku')}</TableCell>
                                    <TableCell>{t('fields.product')}</TableCell>
                                    <TableCell>{t('fields.warehouse')}</TableCell>
                                    <TableCell align="right">{t('fields.quantity')}</TableCell>
                                    <TableCell align="right">{t('fields.avg_cost')}</TableCell>
                                    <TableCell align="right">{t('fields.value')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {valuation.rows.map((row) => (
                                    <TableRow key={`${row.product_id}-${row.warehouse_id}`}>
                                        <TableCell>{row.sku}</TableCell>
                                        <TableCell>{row.product_name}</TableCell>
                                        <TableCell>{row.warehouse_name}</TableCell>
                                        <TableCell align="right">{row.quantity}</TableCell>
                                        <TableCell align="right">{row.average_cost.toFixed(2)}</TableCell>
                                        <TableCell align="right">{row.value.toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <Typography variant="h6" sx={{ mt: 2 }} align="right">
                        {t('fields.total')}: {valuation.total_value.toFixed(2)}
                    </Typography>
                </Paper>
            )}
        </Box>
    );
}
