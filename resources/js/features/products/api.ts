import { apiClient } from '@/lib/apiClient';

export interface ProductStock {
    warehouse_id: number;
    warehouse_name: string;
    quantity: number;
    average_cost: number;
}

export interface ProductListItem {
    id: number;
    sku: string;
    barcode: string | null;
    name: string;
    category_id: number | null;
    category_name: string | null;
    unit_id: number;
    unit_short_name: string;
    type: string;
    sale_price: number;
    default_cost: number;
    tax_rate: number;
    reorder_level: number;
    track_inventory: boolean;
    is_active: boolean;
    stocks: ProductStock[];
    total_stock: number;
}

interface PaginatedResponse<T> {
    data: T[];
}

export async function fetchProducts(): Promise<ProductListItem[]> {
    const { data } = await apiClient.get<PaginatedResponse<ProductListItem>>('/products');
    return data.data;
}
