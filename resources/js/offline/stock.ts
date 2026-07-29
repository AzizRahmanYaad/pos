import type { CachedResponse, OutboxEntry } from '@/offline/db';

/**
 * What is on the shelf, counting the deliveries and sales not yet sent.
 *
 * Everything else about an outage was made to add up — the drawer, the
 * ledgers, the day's takings — while the quantity on hand stayed frozen at
 * whatever the server last said. A shop that booked in a delivery watched
 * the count ignore it, and a till that sold all afternoon reported the same
 * stock at closing as at opening. Both are wrong in opposite directions,
 * which is why they are folded together rather than one at a time: a count
 * that added purchases and ignored sales would drift further from the truth
 * than one that did neither.
 *
 * A queued delivery carries its lines in the effect recorded when it was
 * received, because by then the local copy of the purchase has already been
 * marked received and no longer remembers what arrived. A sale states its
 * own lines in its payload and needs no such help.
 */

export interface StockDelta {
    productId: number;
    warehouseId: number | null;
    quantity: number;
}

function num(value: unknown): number {
    const parsed = typeof value === 'string' ? Number(value) : value;

    return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : 0;
}

/** What one queued write puts on the shelf, or takes off it. */
export function stockDeltas(entry: OutboxEntry): StockDelta[] {
    if (entry.method !== 'POST' || entry.state === 'conflict') return [];

    // Receiving a delivery, and returning goods to the shelf: both were
    // worked out when the write was made, from a record that has since
    // changed underneath it.
    if (entry.effect?.stock) return entry.effect.stock;

    const payload = (entry.data ?? {}) as Record<string, unknown>;
    const path = entry.url.split('?')[0];

    // A manual correction says plainly what it does: the quantity is signed,
    // positive adding to the shelf and negative taking off it, exactly as
    // AdjustStockAction reads it.
    if (path === '/stock-adjustments') {
        return typeof payload.product_id === 'number'
            ? [{
                productId: payload.product_id,
                warehouseId: typeof payload.warehouse_id === 'number' ? payload.warehouse_id : null,
                quantity: num(payload.quantity),
            }]
            : [];
    }

    if (path === '/sales') {
        const items = Array.isArray(payload.items) ? (payload.items as Record<string, unknown>[]) : [];
        const warehouseId = typeof payload.warehouse_id === 'number' ? payload.warehouse_id : null;


        return items
            .filter((item) => typeof item.product_id === 'number')
            .map((item) => ({
                productId: item.product_id as number,
                warehouseId,
                quantity: -num(item.quantity),
            }));
    }

    return [];
}

/** Every product's net movement across everything still queued. */
function movements(entries: OutboxEntry[]): Map<number, StockDelta[]> {
    const byProduct = new Map<number, StockDelta[]>();

    for (const entry of entries) {
        for (const delta of stockDeltas(entry)) {
            if (delta.quantity === 0) continue;

            byProduct.set(delta.productId, [...(byProduct.get(delta.productId) ?? []), delta]);
        }
    }

    return byProduct;
}

export function isStockPath(path: string): boolean {
    return /\/api\/v1\/inventory\/stock(\/summary|\/alerts)?(\?|\{|$)/.test(path)
        || /\/api\/v1\/products(\?|\{|$)/.test(path);
}

/** "…/inventory/stock/summary" is counts, not rows, and folds differently. */
function isSummaryPath(path: string): boolean {
    return path.includes('/inventory/stock/summary');
}

/** The stock list this device holds, which the summary is recounted from. */
function cachedStockRows(caches: CachedResponse[]): Record<string, unknown>[] {
    const prefix = 'GET /api/v1/inventory/stock';

    for (const cached of caches) {
        if (!cached.key.startsWith(prefix)) continue;

        // "/inventory/stock" must not be answered by its own summary.
        const rest = cached.key.slice(prefix.length);

        if (rest !== '' && !rest.startsWith('?') && !rest.startsWith('{')) continue;

        const rows = (cached.body as { data?: unknown })?.data;

        if (Array.isArray(rows) && rows.length) return rows as Record<string, unknown>[];
    }

    return [];
}

/**
 * Move one product's row by what is queued against it.
 *
 * Both shapes are handled because both are drawn from the same numbers: the
 * Stocks page reads total_stock and a per-warehouse breakdown, the product
 * list and the till read total_stock and stocks[]. A till showing a
 * quantity it will not sell is the version of this that loses a customer.
 */
function applyToRow(row: Record<string, unknown>, deltas: StockDelta[]): Record<string, unknown> {
    const net = deltas.reduce((sum, delta) => sum + delta.quantity, 0);
    const total = Math.round((num(row.total_stock) + net) * 10000) / 10000;

    const perWarehouse = (rows: Record<string, unknown>[], key: string) =>
        rows.map((entry) => {
            const moved = deltas
                .filter((delta) => delta.warehouseId === null || delta.warehouseId === entry.warehouse_id)
                .reduce((sum, delta) => sum + delta.quantity, 0);

            return moved === 0
                ? entry
                : { ...entry, [key]: Math.round((num(entry[key]) + moved) * 10000) / 10000 };
        });

    const next: Record<string, unknown> = { ...row, total_stock: total, __pending: true };

    // The Stocks page colours the row by this, so a delivery that clears a
    // shortage has to clear the warning with it.
    if (typeof row.status === 'string') {
        const reorder = num(row.reorder_level);
        next.status = total <= 0 ? 'out' : (total <= reorder ? 'low' : 'ok');
    }

    if (Array.isArray(row.warehouses)) {
        next.warehouses = perWarehouse(row.warehouses as Record<string, unknown>[], 'quantity');
    }

    if (Array.isArray(row.stocks)) {
        next.stocks = perWarehouse(row.stocks as Record<string, unknown>[], 'quantity');
    }

    // Valued at what the device was last told the goods cost. The exact
    // figure needs the server's weighted average across every batch; this is
    // the same approximation the offline journal already uses for cost of
    // goods, and it is corrected the moment the queue drains.
    if (row.stock_value !== undefined) {
        const unitCost = num(row.total_stock) > 0 ? num(row.stock_value) / num(row.total_stock) : 0;
        next.stock_value = Math.round(total * unitCost * 100) / 100;
    }

    return next;
}

/**
 * Add queued movements to whatever the device last heard about stock.
 *
 * Applied when stock is *read*, so a delivery counts exactly while it is
 * waiting and stops counting the moment the server has it — there is no
 * window in which the same crate could be counted twice.
 */
export function foldQueuedIntoStock(
    body: unknown,
    path: string,
    entries: OutboxEntry[],
    caches: CachedResponse[] = [],
): unknown {
    if (body === null || typeof body !== 'object') return body;

    const byProduct = movements(entries);

    if (byProduct.size === 0) return body;

    const shaped = body as { data?: unknown };

    // The headline counts carry no rows of their own, so they are recounted
    // from the stock list the device holds with the same movements applied.
    // Moving the value by a net quantity would be quicker and wrong: what
    // decides "low" or "out" is each product against its own reorder level,
    // and a hundred arriving for one product settles nothing for another.
    if (isSummaryPath(path)) {
        const summary = shaped.data as Record<string, unknown> | undefined;
        const rows = cachedStockRows(caches);

        if (!summary || typeof summary !== 'object' || rows.length === 0) return body;

        let low = 0;
        let out = 0;
        let value = 0;

        for (const row of rows) {
            const moved = byProduct.get(Number(row.id));
            const next = moved ? applyToRow(row, moved) : row;
            const total = num(next.total_stock);

            if (total <= 0) out += 1;
            else if (total <= num(next.reorder_level)) low += 1;

            value += num(next.stock_value);
        }

        return {
            ...shaped,
            data: {
                ...summary,
                low_stock_count: low,
                out_of_stock_count: out,
                total_stock_value: Math.round(value * 100) / 100,
                __pending: true,
            },
        };
    }

    const correct = (row: Record<string, unknown>): Record<string, unknown> => {
        if (typeof row?.id !== 'number') return row;

        const deltas = byProduct.get(row.id);

        return deltas ? applyToRow(row, deltas) : row;
    };

    if (Array.isArray(shaped.data)) {
        return { ...shaped, data: (shaped.data as Record<string, unknown>[]).map(correct) };
    }

    if (Array.isArray(body)) {
        return (body as Record<string, unknown>[]).map(correct);
    }

    if (shaped.data !== null && typeof shaped.data === 'object') {
        return { ...shaped, data: correct(shaped.data as Record<string, unknown>) };
    }

    return body;
}
