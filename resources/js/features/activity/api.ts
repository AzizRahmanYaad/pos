import { apiClient } from '@/lib/apiClient';

export interface ActivityChange {
    field: string;
    from: string | number | boolean | null;
    to: string | number | boolean | null;
}

export interface ActivityEntry {
    id: number;
    module: string;
    event: string;
    description: string;
    subject_label: string | null;
    subject_type: string | null;
    subject_id: number | null;
    user_id: number | null;
    user_name: string | null;
    ip_address: string | null;
    path: string | null;
    method: string | null;
    changes: ActivityChange[];
    created_at: string;
}

export interface ActivityPage {
    data: ActivityEntry[];
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
}

export interface ActivityFilters {
    userId?: number | '';
    module?: string;
    event?: string;
    from?: string;
    to?: string;
    search?: string;
    page?: number;
    perPage?: number;
}

export interface ActivityFilterOptions {
    users: { id: number; name: string }[];
    modules: string[];
    events: string[];
}

/** Only send what is actually set — an empty filter must not narrow anything. */
function toParams(filters: ActivityFilters): Record<string, string | number> {
    const params: Record<string, string | number> = {};

    if (filters.userId) params.user_id = filters.userId;
    if (filters.module) params.module = filters.module;
    if (filters.event) params.event = filters.event;
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    if (filters.search) params.search = filters.search;
    if (filters.page) params.page = filters.page;
    if (filters.perPage) params.per_page = filters.perPage;

    return params;
}

export async function fetchActivity(filters: ActivityFilters = {}): Promise<ActivityPage> {
    const { data } = await apiClient.get('/activity-log', { params: toParams(filters) });

    return {
        data: data.data,
        total: data.meta?.total ?? data.data.length,
        per_page: data.meta?.per_page ?? 25,
        current_page: data.meta?.current_page ?? 1,
        last_page: data.meta?.last_page ?? 1,
    };
}

export async function fetchActivityFilterOptions(): Promise<ActivityFilterOptions> {
    const { data } = await apiClient.get<ActivityFilterOptions>('/activity-log/filters');
    return data;
}

export async function downloadActivityCsv(filters: ActivityFilters = {}): Promise<void> {
    const response = await apiClient.get('/activity-log/export', {
        params: toParams(filters),
        responseType: 'blob',
    });

    const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}
