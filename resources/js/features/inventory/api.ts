import { apiClient } from '@/lib/apiClient';

export interface StockAdjustmentPayload {
    product_id: number;
    warehouse_id: number;
    quantity: number;
    reason: string;
    unit_cost?: number;
}

export async function createStockAdjustment(payload: StockAdjustmentPayload) {
    const { data } = await apiClient.post('/stock-adjustments', payload);
    return data.data;
}
