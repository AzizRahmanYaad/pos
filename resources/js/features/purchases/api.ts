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

export interface PurchaseItem {
    id: number;
    product_id: number;
    product_name: string;
    quantity: number;
    unit_cost: number;
    discount: number;
    tax: number;
    line_total: number;
    received_quantity: number;
    allocated_landed_cost: number;
    landed_unit_cost: number;
    total_cost: number;
}

export interface PurchaseLandedCost {
    id: number;
    description: string;
    amount: number;
    allocation_method: string;
}

export interface PurchaseListItem {
    id: number;
    purchase_number: string;
    supplier_id: number;
    supplier_name: string;
    warehouse_name: string;
    status: 'draft' | 'received' | 'cancelled';
    purchase_date: string;
    subtotal: number;
    discount: number;
    tax: number;
    landed_cost_total: number;
    grand_total: number;
    paid_amount: number;
    due_amount: number;
}

export interface PurchaseDetail extends PurchaseListItem {
    warehouse_id: number;
    items: PurchaseItem[];
    landed_costs: PurchaseLandedCost[];
    created_at: string;
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

export interface PurchasePage {
    data: PurchaseListItem[];
    meta: PageMeta;
}

export async function fetchPurchases(): Promise<PurchaseListItem[]> {
    const { data } = await apiClient.get<PaginatedResponse<PurchaseListItem>>('/purchases', {
        params: { per_page: 500 },
    });
    return data.data;
}

export async function fetchPurchasesPage(params: {
    page: number;
    perPage: number;
    search?: string;
    status?: string;
}): Promise<PurchasePage> {
    const { data } = await apiClient.get<PurchasePage>('/purchases', {
        params: {
            page: params.page,
            per_page: params.perPage,
            ...(params.search ? { 'filter[search]': params.search } : {}),
            ...(params.status ? { 'filter[status]': params.status } : {}),
        },
    });
    return data;
}

export async function fetchPurchase(id: number): Promise<PurchaseDetail> {
    const { data } = await apiClient.get<{ data: PurchaseDetail }>(`/purchases/${id}`);
    return data.data;
}

export async function createPurchase(payload: CreatePurchasePayload) {
    const { data } = await apiClient.post('/purchases', payload);
    return data.data;
}

export interface ReceivePurchasePayment {
    amount: number;
    cash_account_id: number;
    method: 'cash' | 'card' | 'mobile_wallet' | 'bank';
    description?: string;
}

export async function receivePurchase(id: number, payment?: ReceivePurchasePayment) {
    const { data } = await apiClient.post(`/purchases/${id}/receive`, payment ? { payment } : undefined);
    return data.data;
}

export async function cancelPurchase(id: number) {
    const { data } = await apiClient.post(`/purchases/${id}/cancel`);
    return data.data;
}

export async function downloadPurchaseInvoicePdf(
    id: number,
): Promise<{ url: string; filename: string; blob: Blob }> {
    const response = await apiClient.get(`/purchases/${id}/pdf`, { responseType: 'blob' });
    const disposition = String(response.headers['content-disposition'] ?? '');
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] ?? `purchase-${id}.pdf`;
    const blob = new Blob([response.data], { type: 'application/pdf' });
    return { url: URL.createObjectURL(blob), filename, blob };
}
