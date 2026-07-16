import { apiClient } from '@/lib/apiClient';

export interface WarehouseListItem {
    id: number;
    name: string;
    is_default: boolean;
    is_active: boolean;
}

interface CollectionResponse<T> {
    data: T[];
}

export async function fetchWarehouses(): Promise<WarehouseListItem[]> {
    const { data } = await apiClient.get<CollectionResponse<WarehouseListItem>>('/warehouses');
    return data.data;
}
