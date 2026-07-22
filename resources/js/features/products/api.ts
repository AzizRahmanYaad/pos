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
    pricing_mode: 'fixed' | 'margin';
    margin_percent: number | null;
    default_cost: number;
    tax_rate: number;
    reorder_level: number;
    track_inventory: boolean;
    is_active: boolean;
    stocks: ProductStock[];
    total_stock: number;
    average_cost: number;
}

interface PaginatedResponse<T> {
    data: T[];
}

export interface PageMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

export interface ProductPage {
    data: ProductListItem[];
    meta: PageMeta;
}

/** Full catalog in one call — used by the POS screen. */
export async function fetchProducts(): Promise<ProductListItem[]> {
    const { data } = await apiClient.get<PaginatedResponse<ProductListItem>>('/products', {
        params: { per_page: 500 },
    });
    return data.data;
}

/** Paginated, searchable catalog — used by the Products page. */
export async function fetchProductsPage(params: {
    page: number;
    perPage: number;
    search?: string;
}): Promise<ProductPage> {
    const { data } = await apiClient.get<ProductPage>('/products', {
        params: {
            page: params.page,
            per_page: params.perPage,
            ...(params.search ? { 'filter[search]': params.search } : {}),
        },
    });
    return data;
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
    pricing_mode?: 'fixed' | 'margin';
    margin_percent?: number;
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

export interface UpdatePricingPayload {
    pricing_mode: 'fixed' | 'margin';
    margin_percent?: number | null;
    sale_price?: number;
}

export async function updateProductPricing(
    id: number,
    payload: UpdatePricingPayload,
): Promise<ProductListItem> {
    const { data } = await apiClient.put<{ data: ProductListItem }>(`/products/${id}`, payload);
    return data.data;
}

export async function downloadProductListPdf(
    search?: string,
): Promise<{ url: string; filename: string; blob: Blob }> {
    const response = await apiClient.get('/products/report/pdf', {
        params: search ? { search } : {},
        responseType: 'blob',
    });
    const disposition = String(response.headers['content-disposition'] ?? '');
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] ?? 'products.pdf';
    const blob = new Blob([response.data], { type: 'application/pdf' });
    return { url: URL.createObjectURL(blob), filename, blob };
}
