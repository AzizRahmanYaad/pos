import { apiClient } from '@/lib/apiClient';

export interface SaleItem {
    id: number;
    product_id: number;
    product_name: string;
    quantity: number;
    refunded_quantity: number;
    refundable_quantity: number;
    unit_price: number;
    cost_price_snapshot: number;
    discount: number;
    tax: number;
    line_total: number;
}

export interface SalePayment {
    id: number;
    method: string;
    amount: number;
    cash_account_name: string;
}

export interface SaleListItem {
    id: number;
    invoice_number: string;
    customer_id: number | null;
    customer_name: string;
    warehouse_id: number;
    warehouse_name: string;
    cashier_name: string;
    status: 'completed' | 'partially_refunded' | 'refunded' | 'cancelled';
    sale_date: string;
    subtotal: number;
    discount: number;
    tax: number;
    grand_total: number;
    paid_amount: number;
    due_amount: number;
}

export interface SaleDetail extends SaleListItem {
    items: SaleItem[];
    payments: SalePayment[];
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

export interface SalePage {
    data: SaleListItem[];
    meta: PageMeta;
}

export async function fetchSalesPage(params: {
    page: number;
    perPage: number;
    search?: string;
    status?: string;
    from?: string;
    to?: string;
}): Promise<SalePage> {
    const { data } = await apiClient.get<SalePage>('/sales', {
        params: {
            page: params.page,
            per_page: params.perPage,
            ...(params.search ? { 'filter[search]': params.search } : {}),
            ...(params.status ? { 'filter[status]': params.status } : {}),
            ...(params.from ? { 'filter[from]': params.from } : {}),
            ...(params.to ? { 'filter[to]': params.to } : {}),
        },
    });
    return data;
}

export async function fetchSale(id: number): Promise<SaleDetail> {
    const { data } = await apiClient.get<{ data: SaleDetail }>(`/sales/${id}`);
    return data.data;
}

export interface RefundSalePayload {
    items?: Array<{ sale_item_id: number; quantity: number }>;
}

export async function refundSale(id: number, payload?: RefundSalePayload): Promise<SaleDetail> {
    const { data } = await apiClient.post<{ data: SaleDetail }>(`/sales/${id}/refund`, payload ?? {});
    return data.data;
}

export async function downloadSaleInvoicePdf(
    id: number,
): Promise<{ url: string; filename: string; blob: Blob }> {
    const response = await apiClient.get(`/sales/${id}/pdf`, { responseType: 'blob' });
    const disposition = String(response.headers['content-disposition'] ?? '');
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] ?? `sale-${id}.pdf`;
    const blob = new Blob([response.data], { type: 'application/pdf' });
    return { url: URL.createObjectURL(blob), filename, blob };
}
