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

export interface LedgerEntry {
    id: number;
    entry_type: 'debit' | 'credit';
    amount: number;
    running_balance: number;
    description: string | null;
    source_type: string | null;
    transaction_date: string;
    created_by: string | null;
}

export interface LedgerPage {
    data: LedgerEntry[];
    meta: PageMeta;
    current_balance: number;
}

export async function fetchCustomerLedger(
    customerId: number,
    page: number,
): Promise<LedgerPage> {
    const { data } = await apiClient.get<LedgerPage>(`/customers/${customerId}/ledger`, {
        params: { page, per_page: 15 },
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
