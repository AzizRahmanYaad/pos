import { apiClient } from '@/lib/apiClient';

export interface WarehouseListItem {
    id: number;
    name: string;
    address?: string | null;
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

export interface WarehousePayload {
    name: string;
    address?: string | null;
    is_default?: boolean;
    is_active?: boolean;
}

export async function createWarehouse(payload: WarehousePayload): Promise<WarehouseListItem> {
    const { data } = await apiClient.post('/warehouses', payload);
    return data.data;
}

export async function updateWarehouse(id: number, payload: Partial<WarehousePayload>): Promise<WarehouseListItem> {
    const { data } = await apiClient.put(`/warehouses/${id}`, payload);
    return data.data;
}

export async function deleteWarehouse(id: number): Promise<void> {
    await apiClient.delete(`/warehouses/${id}`);
}
