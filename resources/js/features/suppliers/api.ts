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

export async function fetchSuppliers(): Promise<SupplierListItem[]> {
    const { data } = await apiClient.get<PaginatedResponse<SupplierListItem>>('/suppliers');
    return data.data;
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
