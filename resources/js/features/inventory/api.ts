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

export interface StockWarehouseBreakdown {
    warehouse_id: number;
    warehouse_name: string | null;
    quantity: number;
}

export interface StockListItem {
    id: number;
    sku: string | null;
    name: string;
    category_name: string | null;
    unit_short_name: string | null;
    reorder_level: number;
    total_stock: number;
    status: 'out' | 'low' | 'ok';
    stock_value: number;
    warehouses: StockWarehouseBreakdown[];
}

export interface StockSummary {
    tracked_products: number;
    low_stock_count: number;
    out_of_stock_count: number;
    total_stock_value: number;
}

export interface StockAlert {
    id: number;
    name: string;
    sku: string | null;
    total_stock: number;
    reorder_level: number;
    status: 'out' | 'low';
}

export interface StockListFilters {
    search?: string;
    warehouseId?: number;
    status?: 'low' | 'out' | 'reorder';
}

export async function fetchStockList(filters: StockListFilters = {}): Promise<StockListItem[]> {
    const { data } = await apiClient.get<{ data: StockListItem[] }>('/inventory/stock', {
        params: {
            ...(filters.search ? { search: filters.search } : {}),
            ...(filters.warehouseId ? { warehouse_id: filters.warehouseId } : {}),
            ...(filters.status ? { status: filters.status } : {}),
        },
    });
    return data.data;
}

export async function fetchStockSummary(): Promise<StockSummary> {
    const { data } = await apiClient.get<{ data: StockSummary }>('/inventory/stock/summary');
    return data.data;
}

export async function fetchStockAlerts(): Promise<StockAlert[]> {
    const { data } = await apiClient.get<{ data: StockAlert[] }>('/inventory/stock/alerts');
    return data.data;
}
