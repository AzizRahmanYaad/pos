import { apiClient } from '@/lib/apiClient';

export interface PeriodClosingSnapshotDto {
    id: number;
    snapshot_type: string;
    reference_id: number | null;
    reference_label: string | null;
    amount: number;
    quantity: number | null;
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
