import { apiClient } from '@/lib/apiClient';

export interface PeriodClosingSnapshotDto {
    id: number;
    snapshot_type: string;
    reference_id: number | null;
    reference_label: string | null;
    amount: number;
    quantity: number | null;
}

/**
 * What the period traded. `recorded` figures were written down the moment
 * the period closed and are a statement about that moment. `computed`
 * figures belong to periods closed before those figures were kept: nothing
 * was saved, so they are worked out from the records now and labelled as
 * such rather than shown as an em dash that says only that nobody saved a
 * number.
 */
export interface PeriodTradingFiguresDto {
    source: 'recorded' | 'computed';
    revenue: number;
    discounts: number;
    net_revenue: number;
    cogs: number;
    gross_profit: number;
    operating_expenses: number;
    operating_expenses_by_category: { category: string; total: number }[];
    payroll_cost: number;
    net_profit: number;
    purchases_total: number;
    sales_count: number;
}

export interface ActivityLogDto {
    id: number;
    event: string;
    description: string;
    causer_name: string | null;
    properties: { attributes?: Record<string, unknown>; old?: Record<string, unknown> } | null;
    created_at: string;
}

export interface PeriodClosingDto {
    id: number;
    period_type: 'daily' | 'monthly' | 'custom';
    period_start: string;
    period_end: string;
    closed_at: string | null;
    closed_by: string | null;
    status: 'closed' | 'reopened';
    notes: string | null;
    trading_figures: PeriodTradingFiguresDto | null;
    snapshots: PeriodClosingSnapshotDto[];
    activities: ActivityLogDto[];
}

interface CollectionResponse<T> {
    data: T[];
}

export async function fetchPeriodClosings(): Promise<PeriodClosingDto[]> {
    const { data } = await apiClient.get<CollectionResponse<PeriodClosingDto>>('/period-closings');
    return data.data;
}

export async function fetchPeriodClosing(id: number): Promise<PeriodClosingDto> {
    const { data } = await apiClient.get<{ data: PeriodClosingDto }>(`/period-closings/${id}`);
    return data.data;
}

export async function closePeriod(payload: {
    period_type: 'daily' | 'monthly' | 'custom';
    period_start: string;
    period_end: string;
    notes?: string;
}): Promise<PeriodClosingDto> {
    const { data } = await apiClient.post('/period-closings', payload);
    return data.data;
}

export async function reopenPeriod(id: number): Promise<PeriodClosingDto> {
    const { data } = await apiClient.post(`/period-closings/${id}/reopen`);
    return data.data;
}
