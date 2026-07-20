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

export interface CategoryItem {
    id: number;
    name: string;
}

export interface UnitItem {
    id: number;
    name: string;
    short_name: string;
}

export async function fetchCategories(): Promise<CategoryItem[]> {
    const { data } = await apiClient.get<PaginatedResponse<CategoryItem>>('/categories');
    return data.data;
}

export async function fetchUnits(): Promise<UnitItem[]> {
    const { data } = await apiClient.get<PaginatedResponse<UnitItem>>('/units');
    return data.data;
}

export async function createCategory(name: string): Promise<CategoryItem> {
    const { data } = await apiClient.post<{ data: CategoryItem }>('/categories', { name });
    return data.data;
}

export async function createUnit(name: string, shortName: string): Promise<UnitItem> {
    const { data } = await apiClient.post<{ data: UnitItem }>('/units', {
        name,
        short_name: shortName,
        conversion_factor: 1,
    });
    return data.data;
}

export interface CreateProductPayload {
    sku: string;
    barcode?: string;
    name: string;
    category_id?: number | null;
    unit_id: number;
    type: 'standard' | 'service' | 'raw_material';
    sale_price: number;
    default_cost: number;
    tax_rate: number;
    reorder_level: number;
    track_inventory: boolean;
    is_active: boolean;
}

export async function createProduct(payload: CreateProductPayload): Promise<ProductListItem> {
    const { data } = await apiClient.post<{ data: ProductListItem }>('/products', payload);
    return data.data;
}
