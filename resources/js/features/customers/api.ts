import { apiClient } from '@/lib/apiClient';

export interface CustomerListItem {
    id: number;
    name: string;
    phone: string | null;
    address: string | null;
    credit_limit: number;
    is_active: boolean;
    current_balance: number;
}

interface PaginatedResponse<T> {
    data: T[];
}

export interface PageMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

/** Full list in one call — used by the POS customer select. */
export async function fetchCustomers(): Promise<CustomerListItem[]> {
    const { data } = await apiClient.get<PaginatedResponse<CustomerListItem>>('/customers', {
        params: { per_page: 500 },
    });
    return data.data;
}

export interface CustomerPage {
    data: CustomerListItem[];
    meta: PageMeta;
}

export async function fetchCustomersPage(params: {
    page: number;
    perPage: number;
    search?: string;
}): Promise<CustomerPage> {
    const { data } = await apiClient.get<CustomerPage>('/customers', {
        params: {
            page: params.page,
            per_page: params.perPage,
            ...(params.search ? { search: params.search } : {}),
        },
    });
    return data;
}

export interface CreateCustomerPayload {
    name: string;
    phone?: string;
    address?: string;
    opening_balance?: number;
    opening_balance_type?: 'debit' | 'credit';
    credit_limit?: number;
}

export async function createCustomer(payload: CreateCustomerPayload): Promise<CustomerListItem> {
    const { data } = await apiClient.post<{ data: CustomerListItem }>('/customers', payload);
    return data.data;
}

export async function downloadCustomerListPdf(
    search?: string,
): Promise<{ url: string; filename: string; blob: Blob }> {
    const response = await apiClient.get('/customers/report/pdf', {
        params: search ? { search } : {},
        responseType: 'blob',
    });
    const disposition = String(response.headers['content-disposition'] ?? '');
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] ?? 'customers.pdf';
    const blob = new Blob([response.data], { type: 'application/pdf' });
    return { url: URL.createObjectURL(blob), filename, blob };
}

export interface CustomerSummary {
    receivable: number;
    advance: number;
}

export async function fetchCustomerSummary(): Promise<CustomerSummary> {
    const { data } = await apiClient.get<{ data: CustomerSummary }>('/customers/summary');
    return data.data;
}
