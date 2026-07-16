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

export async function fetchCustomers(): Promise<CustomerListItem[]> {
    const { data } = await apiClient.get<PaginatedResponse<CustomerListItem>>('/customers');
    return data.data;
}
