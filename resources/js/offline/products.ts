import { PENDING_FLAG, temporaryId, type CachedResponse, type OutboxEntry } from '@/offline/db';
import { nameById, num } from '@/offline/journal';

/** One field of a cached row, looked up by id — the unit's short name is
 *  what the catalogue prints, not the unit's full name. */
function fieldById(caches: CachedResponse[], path: string, id: unknown, field: string): string | null {
    if (typeof id !== 'number') return null;

    const prefix = `GET /api/v1${path}`;

    for (const cached of caches) {
        if (!cached.key.startsWith(prefix)) continue;

        const rest = cached.key.slice(prefix.length);

        if (rest !== '' && !rest.startsWith('?') && !rest.startsWith('{')) continue;

        const body = cached.body as { data?: unknown };
        const rows = Array.isArray(body?.data) ? body.data as Record<string, unknown>[] : [];
        const match = rows.find((row) => row.id === id);
        const value = match?.[field];

        if (typeof value === 'string') return value;
    }

    return null;
}

/**
 * The product record behind a queued create.
 *
 * A product's payload is nearly the product, but not quite: what it is
 * worth and what is on the shelf are the server's to work out, and the form
 * does not ask for a price at all — that is set afterwards, on the pricing
 * screen. So the payload alone is a row with holes in it exactly where the
 * catalogue and the till print money, and a row with holes in it took the
 * whole screen down.
 *
 * Everywhere else this is covered by copying the shape of a row the server
 * already sent. A shop opening its catalogue for the very first time has no
 * such row — the first product it ever adds, added with no connection, is
 * the one case where nothing can be copied. That is precisely when this
 * matters, so the shape is stated here rather than inferred.
 */
export function buildQueuedProduct(
    entry: OutboxEntry,
    caches: CachedResponse[],
): Record<string, unknown> | null {
    if (entry.method !== 'POST' || entry.url.split('?')[0] !== '/products') return null;

    const payload = (entry.data ?? {}) as Record<string, unknown>;

    return {
        ...payload,
        id: temporaryId(entry.id),
        sku: payload.sku ?? '',
        barcode: payload.barcode ?? null,
        category_id: payload.category_id ?? null,
        category_name: nameById(caches, '/categories', payload.category_id),
        unit_short_name: fieldById(caches, '/units', payload.unit_id, 'short_name') ?? '',
        // Nobody has priced it yet, and nothing has been bought or sold, so
        // every figure here is honestly zero rather than missing. The till
        // reads a zero price as "not for sale", which is the truth until the
        // shopkeeper sets one.
        sale_price: num(payload.sale_price),
        pricing_mode: payload.pricing_mode ?? 'fixed',
        margin_percent: payload.margin_percent ?? null,
        margin_basis: payload.margin_basis ?? 'markup',
        default_cost: num(payload.default_cost),
        reorder_level: num(payload.reorder_level),
        track_inventory: payload.track_inventory ?? true,
        is_active: payload.is_active ?? true,
        stocks: [],
        total_stock: 0,
        average_cost: 0,
        [PENDING_FLAG]: true,
    };
}
