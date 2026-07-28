import { PENDING_FLAG, refundLocally, temporaryId, type CachedResponse, type OutboxEntry } from '@/offline/db';

/**
 * A sale taken with no connection, shown as a record in its own right.
 *
 * The list can be patched with a row, but opening that row asks the server
 * for /sales/{id} — and the sale has no server id yet, so the one thing a
 * cashier reliably wants after taking a sale offline (looking it up again,
 * checking what was in it, taking a return against it) was the one thing
 * that did not work. This builds the same shape the server would have
 * returned, out of what the till already recorded.
 */

function num(value: unknown): number {
    const parsed = typeof value === 'string' ? Number(value) : value;

    return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : 0;
}

function rowsOf(caches: CachedResponse[], path: string): Record<string, unknown>[] {
    const prefix = `GET /api/v1${path}`;

    for (const cached of caches) {
        if (!cached.key.startsWith(prefix)) continue;

        const body = cached.body as { data?: unknown };
        const rows = Array.isArray(body?.data) ? body.data : Array.isArray(cached.body) ? cached.body : null;

        if (rows && rows.length) return rows as Record<string, unknown>[];
    }

    return [];
}

function nameById(caches: CachedResponse[], path: string, id: unknown, fallback: string): string {
    if (typeof id !== 'number') return fallback;

    const match = rowsOf(caches, path).find((row) => row.id === id);

    return typeof match?.name === 'string' ? match.name : fallback;
}

/** The temporary id this queued sale was given on the list screen. */
export function saleIdFor(entry: OutboxEntry): number {
    return temporaryId(entry.id);
}

/**
 * Rebuild the sale the server never saw, in the shape its detail screen
 * expects — items, payments, totals and all.
 */
export function buildQueuedSale(entry: OutboxEntry, caches: CachedResponse[]): Record<string, unknown> | null {
    if (entry.method !== 'POST' || entry.url.split('?')[0] !== '/sales') return null;

    const payload = (entry.data ?? {}) as Record<string, unknown>;
    const products = rowsOf(caches, '/products');

    const rawItems = Array.isArray(payload.items) ? (payload.items as Record<string, unknown>[]) : [];
    const rawPayments = Array.isArray(payload.payments) ? (payload.payments as Record<string, unknown>[]) : [];

    const items = rawItems.map((item, index) => {
        const product = products.find((row) => row.id === item.product_id);
        const quantity = num(item.quantity);
        const unitPrice = num(item.unit_price);
        const unitCost = num(product?.average_cost) || num(product?.default_cost);

        return {
            // Stable and negative, so the return dialog can address a line
            // without ever colliding with a real one.
            id: -(index + 1),
            product_id: item.product_id,
            product_name: typeof product?.name === 'string' ? product.name : '',
            quantity,
            refunded_quantity: 0,
            refundable_quantity: quantity,
            unit_price: unitPrice,
            cost_price_snapshot: unitCost,
            total_cost: unitCost * quantity,
            discount: 0,
            tax: 0,
            line_total: unitPrice * quantity,
        };
    });

    const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
    const discount = num(payload.discount);
    const grandTotal = Math.max(0, subtotal - discount);
    const paid = rawPayments.reduce((sum, payment) => sum + num(payment.amount), 0);

    const payments = rawPayments.map((payment, index) => ({
        id: -(index + 1),
        method: String(payment.method ?? 'cash'),
        amount: num(payment.amount),
        // Carried, not just named: a return has to put the money back in the
        // account it came out of, and a name cannot be posted against.
        cash_account_id: typeof payment.cash_account_id === 'number' ? payment.cash_account_id : null,
        cash_account_name: nameById(caches, '/cash-accounts', payment.cash_account_id, ''),
    }));

    return {
        id: saleIdFor(entry),
        // Deliberately not in the server's numbering: nobody should be able
        // to mistake a provisional reference for a real invoice number.
        invoice_number: entry.id.slice(0, 8).toUpperCase(),
        customer_id: (payload.customer_id as number | null) ?? null,
        customer_name: nameById(caches, '/customers', payload.customer_id, 'Walk-in'),
        warehouse_id: payload.warehouse_id ?? null,
        warehouse_name: nameById(caches, '/warehouses', payload.warehouse_id, ''),
        cashier_name: '',
        status: 'completed',
        sale_date: new Date(entry.createdAt).toISOString(),
        subtotal,
        discount,
        tax: 0,
        grand_total: grandTotal,
        cost_total: items.reduce((sum, item) => sum + item.total_cost, 0),
        profit: subtotal - discount - items.reduce((sum, item) => sum + item.total_cost, 0),
        paid_amount: paid,
        due_amount: Math.max(0, grandTotal - paid),
        items,
        payments,
        [PENDING_FLAG]: true,
    };
}

/**
 * The queued sale behind a "/sales/{id}" the device has no cached copy of.
 *
 * Returns the detail response the screen expects, or null when this is a
 * real sale the device simply has not seen — in which case the caller is
 * right to report that there is nothing to show.
 */
export function queuedSaleDetail(
    path: string,
    entries: OutboxEntry[],
    caches: CachedResponse[],
): unknown | null {
    const match = path.match(/\/sales\/(-?\d+)$/);

    if (!match) return null;

    const wanted = Number(match[1]);
    const entry = entries.find((row) => row.method === 'POST'
        && row.url.split('?')[0] === '/sales'
        && saleIdFor(row) === wanted);

    if (!entry) return null;

    const sale = buildQueuedSale(entry, caches);

    if (sale === null) return null;

    // A return taken during the same outage has nothing cached to change —
    // this sale exists only in the queue. Without applying it here the
    // cashier takes the return, is told it was accepted, and then sees the
    // sale still standing at its full amount.
    const refunded = entries
        .filter((row) => row.method === 'POST' && row.url === `/sales/${wanted}/refund`)
        .reduce((record, row) => refundLocally(record, (row.data ?? {}) as Record<string, unknown>), sale);

    return { data: refunded };
}
