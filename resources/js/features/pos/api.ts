import { apiClient } from '@/lib/apiClient';

export interface SaleItemPayload {
    product_id: number;
    quantity: number;
    unit_id: number;
    unit_price: number;
}

export interface SalePaymentPayload {
    cash_account_id: number;
    method: 'cash' | 'card' | 'mobile_wallet' | 'bank';
    amount: number;
}

export interface CreateSalePayload {
    customer_id?: number | null;
    warehouse_id: number;
    discount?: number;
    items: SaleItemPayload[];
    payments: SalePaymentPayload[];
}

export interface SaleReceipt {
    id: number;
    invoice_number: string;
    customer_name: string;
    warehouse_name: string;
    sale_date: string;
    subtotal: number;
    discount: number;
    tax: number;
    grand_total: number;
    paid_amount: number;
    due_amount: number;
    items: Array<{
        product_name: string;
        quantity: number;
        unit_price: number;
        line_total: number;
    }>;
    payments: Array<{ method: string; amount: number }>;
}

export async function createSale(payload: CreateSalePayload): Promise<SaleReceipt> {
    const { data } = await apiClient.post('/sales', payload);
    return data.data;
}
