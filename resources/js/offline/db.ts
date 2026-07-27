import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/** A server response kept so the screen can still be drawn with no network. */
export interface CachedResponse {
    /** Method + full URL including query string. */
    key: string;
    /** Who it was fetched for — one device, several staff, separate data. */
    userId: number;
    status: number;
    body: unknown;
    fetchedAt: number;
}

export type OutboxState = 'pending' | 'sending' | 'failed' | 'conflict';

/** A change made while offline, waiting its turn to reach the server. */
export interface OutboxEntry {
    /** Also the Idempotency-Key, so a replay cannot duplicate the change. */
    id: string;
    userId: number;
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    url: string;
    data: unknown;
    /** What the user was doing, in their own words, for the pending list. */
    label: string;
    createdAt: number;
    state: OutboxState;
    attempts: number;
    /** Why the server refused it, once it has. */
    error?: string;
    errorStatus?: number;
}

/**
 * What the server called a record that this device had to name for itself.
 *
 * A customer added with no connection gets a temporary id, and a sale made
 * to that customer minutes later — still with no connection — refers to it.
 * When the queue finally drains, the server knows nothing of that temporary
 * id, so the sale would be refused and the day's takings lost. This is how
 * the one becomes the other on the way out.
 */
export interface IdAlias {
    tempId: number;
    realId: number;
    userId: number;
}

interface OfflineDb extends DBSchema {
    responses: {
        key: string;
        value: CachedResponse;
        indexes: { byUser: number };
    };
    outbox: {
        key: string;
        value: OutboxEntry;
        indexes: { byUser: number; byCreatedAt: number; byState: string };
    };
    idmap: {
        key: number;
        value: IdAlias;
        indexes: { byUser: number };
    };
}

const DB_NAME = 'asan-hesab-offline';
const DB_VERSION = 2;

let connection: Promise<IDBPDatabase<OfflineDb>> | null = null;

/**
 * IndexedDB is unavailable in a few real situations — private browsing on
 * some browsers, storage denied, an ancient device. The application must
 * still work online in those cases, so every caller treats a failure here
 * as "no offline support", never as a broken app.
 */
export function db(): Promise<IDBPDatabase<OfflineDb>> {
    if (!connection) {
        connection = openDB<OfflineDb>(DB_NAME, DB_VERSION, {
            // Each step runs only for devices that have not had it yet, so an
            // upgrade never destroys a queue somebody is still waiting on.
            upgrade(database, oldVersion) {
                if (oldVersion < 1) {
                    const responses = database.createObjectStore('responses', { keyPath: 'key' });
                    responses.createIndex('byUser', 'userId');

                    const outbox = database.createObjectStore('outbox', { keyPath: 'id' });
                    outbox.createIndex('byUser', 'userId');
                    outbox.createIndex('byCreatedAt', 'createdAt');
                    outbox.createIndex('byState', 'state');
                }

                if (oldVersion < 2) {
                    const idmap = database.createObjectStore('idmap', { keyPath: 'tempId' });
                    idmap.createIndex('byUser', 'userId');
                }
            },
        });
    }

    return connection;
}

export async function isAvailable(): Promise<boolean> {
    try {
        await db();
        return true;
    } catch {
        return false;
    }
}

export async function readCache(key: string, userId: number): Promise<CachedResponse | undefined> {
    try {
        const hit = await (await db()).get('responses', key);

        // A cache entry belonging to whoever used this device last is not
        // this user's data to see.
        return hit && hit.userId === userId ? hit : undefined;
    } catch {
        return undefined;
    }
}

/**
 * The cached answer for this request, or failing that for the same screen
 * asked slightly differently.
 *
 * Keys carry their query string, so "/customers" and "/customers?page=1" are
 * different entries — and a list screen almost always asks with paging or a
 * search term attached. Insisting on an exact match meant a device could
 * hold a perfectly good copy of the customer list and still show the user
 * an empty table. A near miss is worth far more than nothing here: the
 * alternative is not fresher data, it is no data.
 */
export async function readCacheForPath(
    key: string,
    path: string,
    userId: number,
): Promise<CachedResponse | undefined> {
    const exact = await readCache(key, userId);

    if (exact) return exact;

    try {
        const all = await (await db()).getAllFromIndex('responses', 'byUser', userId);
        const prefix = `GET ${path}`;

        return all
            .filter((entry) => {
                if (!entry.key.startsWith(prefix)) return false;

                // "/customers" must not answer for "/customer-groups".
                const rest = entry.key.slice(prefix.length);

                return rest === '' || rest.startsWith('?') || rest.startsWith('{');
            })
            .sort((a, b) => b.fetchedAt - a.fetchedAt)[0];
    } catch {
        return undefined;
    }
}

export async function writeCache(entry: CachedResponse): Promise<void> {
    try {
        await (await db()).put('responses', entry);
    } catch {
        // A full or unavailable store costs us offline reads, nothing more.
    }
}

/** On sign-out, someone else's data must not be left on the device. */
export async function clearCacheFor(userId: number): Promise<void> {
    try {
        const database = await db();
        const tx = database.transaction('responses', 'readwrite');
        const keys = await tx.store.index('byUser').getAllKeys(userId);
        await Promise.all(keys.map((key) => tx.store.delete(key)));
        await tx.done;
    } catch {
        // Nothing to clear.
    }
}

export async function enqueue(entry: OutboxEntry): Promise<void> {
    await (await db()).put('outbox', entry);
}

export async function updateEntry(entry: OutboxEntry): Promise<void> {
    try {
        await (await db()).put('outbox', entry);
    } catch {
        // Ignore.
    }
}

export async function removeEntry(id: string): Promise<void> {
    try {
        await (await db()).delete('outbox', id);
    } catch {
        // Ignore.
    }
}

/** Oldest first: the order things happened is the order they must be applied. */
export async function pendingEntries(userId: number): Promise<OutboxEntry[]> {
    try {
        const all = await (await db()).getAllFromIndex('outbox', 'byUser', userId);

        return all.sort((a, b) => a.createdAt - b.createdAt);
    } catch {
        return [];
    }
}

export async function countUnsent(userId: number): Promise<number> {
    const entries = await pendingEntries(userId);

    return entries.filter((entry) => entry.state !== 'conflict').length;
}

/** A record that exists only on this device so far. */
export const PENDING_FLAG = '__pending';

/** Temporary, negative, and stable per queue entry so it never collides. */
export function temporaryId(entryId: string): number {
    let hash = 0;

    for (let i = 0; i < entryId.length; i += 1) {
        hash = (hash * 31 + entryId.charCodeAt(i)) | 0;
    }

    return -Math.abs(hash || 1);
}

/** Record what the server called something this device had named itself. */
export async function rememberRealId(tempId: number, realId: number, userId: number): Promise<void> {
    try {
        await (await db()).put('idmap', { tempId, realId, userId });
    } catch {
        // Ignore: the alias is only ever an improvement on the raw id.
    }
}

export async function idAliases(userId: number): Promise<Map<number, number>> {
    try {
        const rows = await (await db()).getAllFromIndex('idmap', 'byUser', userId);

        return new Map(rows.map((row) => [row.tempId, row.realId]));
    } catch {
        return new Map();
    }
}

/**
 * Swap every temporary id in a queued change for the real one.
 *
 * Ids appear at any depth — a sale carries its customer at the top and a
 * product inside each line — so this walks the whole payload rather than
 * naming the fields it knows about, which would quietly miss the next one
 * somebody adds.
 */
export function resolveAliases<T>(value: T, aliases: Map<number, number>): T {
    if (aliases.size === 0) return value;

    if (typeof value === 'number') {
        return (aliases.get(value) ?? value) as T;
    }

    if (Array.isArray(value)) {
        return value.map((item) => resolveAliases(item, aliases)) as T;
    }

    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .map(([field, item]) => [field, resolveAliases(item, aliases)]),
        ) as T;
    }

    return value;
}

/** "/customers/42" -> "/customers"; "/customers" -> "/customers". */
function resourceRoot(url: string): string {
    const [path] = url.split('?');

    return '/' + (path.replace(/^\//, '').split('/')[0] ?? '');
}

function idFromUrl(url: string): number | null {
    const parts = url.split('?')[0].split('/').filter(Boolean);
    const last = Number(parts[parts.length - 1]);

    return Number.isFinite(last) ? last : null;
}

/** The rows of a list response, whether it is wrapped in "data" or bare. */
function listRows(body: unknown): Record<string, unknown>[] | null {
    if (Array.isArray(body)) return body as Record<string, unknown>[];

    if (body !== null && typeof body === 'object') {
        const shaped = body as { data?: unknown };

        if (Array.isArray(shaped.data)) return shaped.data as Record<string, unknown>[];
    }

    return null;
}

function patchList(body: unknown, apply: (rows: Record<string, unknown>[]) => Record<string, unknown>[]): unknown {
    const rows = listRows(body);

    if (rows === null) return body;

    const next = apply(rows);

    if (Array.isArray(body)) return next;

    const shaped = body as { data?: unknown; meta?: unknown };

    // A paginated screen prints the count and sizes its pager from meta. Left
    // alone it would say "24 products" over a table of 25, and the last page
    // would be unreachable.
    const meta = shaped.meta;
    const patchedMeta =
        meta !== null && typeof meta === 'object' && typeof (meta as { total?: unknown }).total === 'number'
            ? { ...meta, total: Math.max(0, (meta as { total: number }).total + (next.length - rows.length)) }
            : meta;

    return { ...shaped, data: next, ...(patchedMeta === undefined ? {} : { meta: patchedMeta }) };
}

/**
 * The API path a "<thing>_id" field points at.
 *
 * Fields are snake_case and paths are kebab-case, so expense_category_id
 * lives at /expense-categories — not /expense_categorys, which is what a
 * naive pluraliser produces and what silently found nothing.
 */
function lookupPath(base: string): string {
    const kebab = base.replace(/_/g, '-');

    if (kebab.endsWith('y')) return `${kebab.slice(0, -1)}ies`;
    if (/(s|x|z|ch|sh)$/.test(kebab)) return `${kebab}es`;

    return `${kebab}s`;
}

/**
 * Fill in the names a list column shows but a form never sends.
 *
 * A product form posts category_id and unit_id; the products table draws
 * category_name and unit_short_name. Storing the raw payload therefore
 * produced a row with blank columns — which is why a product created with
 * no connection looked like nothing had happened, while a customer (whose
 * form happens to carry every column the list shows) appeared correctly.
 *
 * Every "<thing>_id" is resolved against the cached list of those things,
 * which the device already holds.
 */
function withResolvedNames(
    record: Record<string, unknown>,
    caches: CachedResponse[],
): Record<string, unknown> {
    const enriched = { ...record };

    for (const [field, value] of Object.entries(record)) {
        if (!field.endsWith('_id') || typeof value !== 'number') continue;

        const base = field.slice(0, -3);
        const prefix = `GET /api/v1/${lookupPath(base)}`;
        const source = caches.find((entry) => entry.key.startsWith(prefix));
        const body = source?.body as { data?: unknown } | undefined;
        const rows = Array.isArray(body?.data) ? (body.data as Record<string, unknown>[]) : [];
        const match = rows.find((row) => row.id === value);

        if (!match) continue;

        // Lists do not always spell the column the way the field is spelled:
        // an expense carries expense_category_id and the table draws
        // category_name. Set both the full name and the short one so the
        // column is filled whichever the screen asked for.
        const short = base.split('_').slice(-1)[0];

        if (typeof match.name === 'string') {
            enriched[`${base}_name`] = match.name;
            enriched[`${short}_name`] = match.name;
        }

        if (typeof match.short_name === 'string') {
            enriched[`${base}_short_name`] = match.short_name;
            enriched[`${short}_short_name`] = match.short_name;
        }
    }

    return enriched;
}

/** The empty value of whatever type a column holds. */
function emptyLike(value: unknown): unknown {
    if (typeof value === 'number') return 0;
    if (typeof value === 'boolean') return false;
    if (typeof value === 'string') return '';
    if (Array.isArray(value)) return [];

    return null;
}

/**
 * Give a queued record the same shape the server would have sent back.
 *
 * A list screen does more than print what it is given: it calls
 * average_cost.toFixed(2), formats amount, counts total_stock. A record
 * built from the form's payload alone has none of those, and React does not
 * quietly skip such a row — it throws mid-render and takes the entire table
 * with it. That is why creating a product with no connection *emptied* the
 * products list instead of adding to it: strictly worse than doing nothing.
 *
 * The shape is copied from a record the server already sent for this same
 * resource, so no column has to be listed by hand here and no screen can be
 * left out — whatever fields a row has, the queued one has too, each filled
 * with the empty value of its own type.
 */
function withListShape(
    record: Record<string, unknown>,
    sample: Record<string, unknown> | null,
): Record<string, unknown> {
    if (!sample) return record;

    const shaped = { ...record };

    for (const [field, value] of Object.entries(sample)) {
        if (!(field in shaped)) shaped[field] = emptyLike(value);
    }

    return shaped;
}

/**
 * Whether a cached response belongs to the resource being written to.
 *
 * The remainder after the resource name has to be a path segment, a query
 * string, or the JSON of the request's params — that last one being how
 * every list screen that pages or filters is keyed. Omitting it meant a
 * queued change was applied only to a bare "/expenses" and never to the
 * "/expenses{"per_page":500}" the screen actually reads, so the record was
 * saved, kept, and synced correctly, and remained invisible throughout.
 */
function belongsToResource(key: string, root: string): boolean {
    if (!key.includes(root)) return false;

    const after = key.split(root)[1];

    return after === undefined || after === '' || /^[/?{]/.test(after);
}

/**
 * Show a queued change on the device that made it.
 *
 * Without this the queue works perfectly and the user sees nothing: they
 * add a customer offline, the list does not change, and as far as they are
 * concerned the application simply ignored them. Every cached list for the
 * same resource is patched so the record appears, marked as not yet sent.
 */
export async function applyWriteLocally(entry: OutboxEntry): Promise<Record<string, unknown> | null> {
    try {
        const database = await db();
        const tx = database.transaction('responses', 'readwrite');
        const all = await tx.store.index('byUser').getAll(entry.userId);
        const root = resourceRoot(entry.url);
        const targetId = idFromUrl(entry.url);
        const payload = (entry.data ?? {}) as Record<string, unknown>;
        const tempId = temporaryId(entry.id);

        // "/customers" must not touch "/customer-groups", hence the boundary
        // check on every cache considered here.
        const mine = all.filter((cached) => belongsToResource(cached.key, root));

        // Any row the server has already sent for this resource, to copy the
        // shape of. Lists are asked for in several ways; the first one that
        // actually holds a row will do.
        const sample = mine.map((cached) => listRows(cached.body)?.[0] ?? null).find(Boolean) ?? null;

        let optimistic: Record<string, unknown> | null = null;

        for (const cached of mine) {
            let body = cached.body;

            if (entry.method === 'POST' && targetId === null) {
                optimistic = optimistic ?? withListShape(
                    withResolvedNames({ ...payload, id: tempId, [PENDING_FLAG]: true }, all),
                    sample,
                );
                body = patchList(body, (rows) => [optimistic as Record<string, unknown>, ...rows]);
            } else if ((entry.method === 'PUT' || entry.method === 'PATCH') && targetId !== null) {
                body = patchList(body, (rows) =>
                    rows.map((row) => (row.id === targetId ? { ...row, ...payload, [PENDING_FLAG]: true } : row)));
            } else if (entry.method === 'DELETE' && targetId !== null) {
                body = patchList(body, (rows) => rows.filter((row) => row.id !== targetId));
            } else {
                continue;
            }

            await tx.store.put({ ...cached, body });
        }

        await tx.done;

        return optimistic;
    } catch {
        return null;
    }
}
