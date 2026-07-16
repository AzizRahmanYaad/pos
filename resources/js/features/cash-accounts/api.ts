import { apiClient } from '@/lib/apiClient';

export interface CashAccountListItem {
    id: number;
    name: string;
    type: string;
    is_active: boolean;
}

interface CollectionResponse<T> {
    data: T[];
}

export async function fetchCashAccounts(): Promise<CashAccountListItem[]> {
    const { data } = await apiClient.get<CollectionResponse<CashAccountListItem>>('/cash-accounts');
    return data.data;
}
