import { apiClient } from '@/lib/apiClient';

export interface SupplierListItem {
    id: number;
    name: string;
    phone: string | null;
    address: string | null;
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

export async function fetchSuppliers(): Promise<SupplierListItem[]> {
    const { data } = await apiClient.get<PaginatedResponse<SupplierListItem>>('/suppliers', {
        params: { per_page: 500 },
    });
    return data.data;
}

export interface SupplierPage {
    data: SupplierListItem[];
    meta: PageMeta;
}

export async function fetchSuppliersPage(params: {
    page: number;
    perPage: number;
    search?: string;
}): Promise<SupplierPage> {
    const { data } = await apiClient.get<SupplierPage>('/suppliers', {
        params: {
            page: params.page,
            per_page: params.perPage,
            ...(params.search ? { search: params.search } : {}),
        },
    });
    return data;
}

export interface CreateSupplierPayload {
    name: string;
    phone?: string;
    address?: string;
    opening_balance?: number;
    opening_balance_type?: 'debit' | 'credit';
}

export async function createSupplier(payload: CreateSupplierPayload): Promise<SupplierListItem> {
    const { data } = await apiClient.post<{ data: SupplierListItem }>('/suppliers', payload);
    return data.data;
}
