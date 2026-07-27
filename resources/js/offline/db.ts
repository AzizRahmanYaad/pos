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
}

const DB_NAME = 'asan-hesab-offline';
const DB_VERSION = 1;

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
            upgrade(database) {
                const responses = database.createObjectStore('responses', { keyPath: 'key' });
                responses.createIndex('byUser', 'userId');

                const outbox = database.createObjectStore('outbox', { keyPath: 'id' });
                outbox.createIndex('byUser', 'userId');
                outbox.createIndex('byCreatedAt', 'createdAt');
                outbox.createIndex('byState', 'state');
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
function temporaryId(entryId: string): number {
    let hash = 0;

    for (let i = 0; i < entryId.length; i += 1) {
        hash = (hash * 31 + entryId.charCodeAt(i)) | 0;
    }

    return -Math.abs(hash || 1);
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

function patchList(body: unknown, apply: (rows: Record<string, unknown>[]) => Record<string, unknown>[]): unknown {
    if (body === null || typeof body !== 'object') return body;

    const shaped = body as { data?: unknown };

    if (Array.isArray(shaped.data)) {
        return { ...shaped, data: apply(shaped.data as Record<string, unknown>[]) };
    }

    if (Array.isArray(body)) return apply(body as Record<string, unknown>[]);

    return body;
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

        let optimistic: Record<string, unknown> | null = null;

        for (const cached of all) {
            // Only caches for this resource; "/customers" must not touch
            // "/customer-groups", hence the boundary check.
            const after = cached.key.split(root)[1];

            if (!cached.key.includes(root) || (after !== undefined && after !== '' && !/^[/?]/.test(after))) {
                continue;
            }

            let body = cached.body;

            if (entry.method === 'POST' && targetId === null) {
                optimistic = optimistic ?? withResolvedNames(
                    { ...payload, id: tempId, [PENDING_FLAG]: true },
                    all,
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
