import { PENDING_FLAG, receiveLocally, temporaryId, type CachedResponse, type OutboxEntry } from '@/offline/db';

/**
 * A purchase entered with no connection, shown as a record in its own right.
 *
 * The list draws a purchase's grand total, and a purchase built from its
 * payload alone has no totals at all — the payload carries lines, not
 * figures. So the row went in undefined and the whole Purchases screen died
 * on `grand_total.toFixed(2)`: a shopkeeper who entered a delivery during an
 * outage lost the screen they entered it on, and every purchase already on
 * it. Worse than the record not appearing, because it took the rest with it.
 *
 * This builds what the server would have returned, out of what the device
 * already holds — the same job buildQueuedSale does for the till, and the
 * reason a queued purchase can then be opened and received like any other.
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

/** The temporary id this queued purchase was given on the list screen. */
export function purchaseIdFor(entry: OutboxEntry): number {
    return temporaryId(entry.id);
}

/** A purchase create still waiting to be sent. */
function isPurchaseCreate(entry: OutboxEntry): boolean {
    return entry.method === 'POST' && entry.url.split('?')[0] === '/purchases';
}

/**
 * Rebuild the purchase the server never saw, in the shape its screens
 * expect — lines, totals, landed costs and all.
 *
 * The arithmetic follows CreatePurchaseAction: the grand total is the lines
 * less any discount plus any tax, and landed costs sit *outside* it, because
 * they are an expense paid to somebody else rather than money owed to this
 * supplier.
 */
export function buildQueuedPurchase(
    entry: OutboxEntry,
    caches: CachedResponse[],
): Record<string, unknown> | null {
    if (!isPurchaseCreate(entry)) return null;

    const payload = (entry.data ?? {}) as Record<string, unknown>;
    const rawItems = Array.isArray(payload.items) ? (payload.items as Record<string, unknown>[]) : [];
    const rawLanded = Array.isArray(payload.landed_costs) ? (payload.landed_costs as Record<string, unknown>[]) : [];

    const landedTotal = rawLanded.reduce((sum, row) => sum + num(row.amount), 0);
    const totalLineValue = rawItems.reduce((sum, item) => sum + num(item.quantity) * num(item.unit_cost), 0);

    const items = rawItems.map((item, index) => {
        const quantity = num(item.quantity);
        const unitCost = num(item.unit_cost);
        const lineTotal = Math.round(quantity * unitCost * 100) / 100;

        // The same proportional-by-value split the receive step makes, shown
        // as an estimate — exactly as the server previews it on a draft.
        const share = totalLineValue > 0
            ? landedTotal * ((quantity * unitCost) / totalLineValue)
            : (rawItems.length > 0 ? landedTotal / rawItems.length : 0);
        const landedUnitCost = quantity > 0 ? unitCost + share / quantity : unitCost;

        return {
            // Stable and negative, so nothing can collide with a real line.
            id: -(index + 1),
            product_id: item.product_id,
            product_name: nameById(caches, '/products', item.product_id, ''),
            quantity,
            unit_cost: unitCost,
            discount: 0,
            tax: 0,
            line_total: lineTotal,
            received_quantity: 0,
            allocated_landed_cost: Math.round(share * 100) / 100,
            landed_unit_cost: Math.round(landedUnitCost * 10000) / 10000,
            total_cost: Math.round(quantity * landedUnitCost * 100) / 100,
            landed_cost_is_estimated: landedTotal > 0,
        };
    });

    const subtotal = Math.round(items.reduce((sum, item) => sum + item.line_total, 0) * 100) / 100;
    const discount = num(payload.discount);
    const tax = num(payload.tax);
    const grandTotal = Math.round((subtotal - discount + tax) * 100) / 100;

    return {
        id: purchaseIdFor(entry),
        // Deliberately outside the server's numbering, so a provisional
        // reference can never be mistaken for a real purchase number.
        purchase_number: entry.id.slice(0, 8).toUpperCase(),
        supplier_id: payload.supplier_id ?? null,
        supplier_name: nameById(caches, '/suppliers', payload.supplier_id, ''),
        warehouse_id: payload.warehouse_id ?? null,
        warehouse_name: nameById(caches, '/warehouses', payload.warehouse_id, ''),
        status: 'draft',
        purchase_date: typeof payload.purchase_date === 'string'
            ? payload.purchase_date
            : new Date(entry.createdAt).toISOString(),
        subtotal,
        discount,
        tax,
        landed_cost_total: Math.round(landedTotal * 100) / 100,
        grand_total: grandTotal,
        paid_amount: 0,
        due_amount: grandTotal,
        items,
        landed_costs: rawLanded.map((row, index) => ({
            id: -(index + 1),
            description: typeof row.description === 'string' ? row.description : '',
            amount: num(row.amount),
            allocation_method: 'value',
        })),
        created_at: new Date(entry.createdAt).toISOString(),
        [PENDING_FLAG]: true,
    };
}

/**
 * The queued purchase behind a "/purchases/{id}" the device has no cached
 * copy of.
 *
 * Returns the detail response the screen expects, or null when this is a
 * real purchase the device simply has not seen — in which case the caller
 * is right to report that there is nothing to show.
 */
export function queuedPurchaseDetail(
    path: string,
    entries: OutboxEntry[],
    caches: CachedResponse[],
): unknown | null {
    const match = path.match(/\/purchases\/(-?\d+)$/);

    if (!match) return null;

    const wanted = Number(match[1]);
    const entry = entries.find((row) => isPurchaseCreate(row) && purchaseIdFor(row) === wanted);

    if (!entry) return null;

    const purchase = buildQueuedPurchase(entry, caches);

    if (purchase === null) return null;

    // Receiving or cancelling it during the same outage has nothing cached
    // to change — this purchase exists only in the queue. Without applying
    // them here the delivery is booked in, reported as accepted, and then
    // shown still sitting as a draft.
    return {
        data: entries
            .filter((row) => row.method === 'POST' && row.state !== 'conflict')
            .reduce((current, row) => {
                const action = row.url.split('?')[0];
                const data = (row.data ?? {}) as Record<string, unknown>;

                if (action === `/purchases/${wanted}/receive`) return receiveLocally(current, data);
                if (action === `/purchases/${wanted}/cancel`) {
                    return { ...current, status: 'cancelled', [PENDING_FLAG]: true };
                }

                return current;
            }, purchase),
    };
}
