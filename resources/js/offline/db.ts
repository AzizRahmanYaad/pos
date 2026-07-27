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
