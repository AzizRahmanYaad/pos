import { apiClient } from '@/lib/apiClient';

export interface PurchaseItemPayload {
    product_id: number;
    quantity: number;
    unit_id: number;
    unit_cost: number;
}

export interface LandedCostPayload {
    description: string;
    amount: number;
}

export interface CreatePurchasePayload {
    supplier_id: number;
    warehouse_id: number;
    purchase_date: string;
    items: PurchaseItemPayload[];
    landed_costs?: LandedCostPayload[];
}

export interface PurchaseListItem {
    id: number;
    purchase_number: string;
    supplier_name: string;
    warehouse_name: string;
    status: 'draft' | 'received' | 'cancelled';
    purchase_date: string;
    subtotal: number;
    landed_cost_total: number;
    grand_total: number;
    due_amount: number;
}

interface PaginatedResponse<T> {
    data: T[];
}

export async function fetchPurchases(): Promise<PurchaseListItem[]> {
    const { data } = await apiClient.get<PaginatedResponse<PurchaseListItem>>('/purchases');
    return data.data;
}

export async function createPurchase(payload: CreatePurchasePayload) {
    const { data } = await apiClient.post('/purchases', payload);
    return data.data;
}

export async function receivePurchase(id: number) {
    const { data } = await apiClient.post(`/purchases/${id}/receive`);
    return data.data;
}

export async function cancelPurchase(id: number) {
    const { data } = await apiClient.post(`/purchases/${id}/cancel`);
    return data.data;
}
