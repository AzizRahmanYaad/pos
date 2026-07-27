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
    /**
     * True when the till took the sale with no connection. The money and the
     * goods have changed hands either way, so the cashier still gets a
     * receipt — it simply carries a provisional number until the server has
     * seen it and issued the real one.
     */
    queued?: boolean;
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

/**
 * @param draft what the till already knows about this sale — product names,
 *              totals, tender — used to print a receipt when the sale could
 *              not be sent and there is no server answer to print from.
 */
export async function createSale(
    payload: CreateSalePayload,
    draft: Omit<SaleReceipt, 'id' | 'invoice_number' | 'queued'>,
): Promise<SaleReceipt> {
    const response = await apiClient.post('/sales', payload);

    if (response.status === 202 && response.data?.queued) {
        const reference = String(response.data.queue_id ?? '').slice(0, 8).toUpperCase();

        return {
            ...draft,
            queued: true,
            id: 0,
            // Deliberately not in the server's numbering sequence: nobody
            // should mistake this for a real invoice number, and two tills
            // offline at once must not both claim the same one.
            invoice_number: `OFF-${reference}`,
        };
    }

    return response.data.data;
}
