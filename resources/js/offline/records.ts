import type { CachedResponse, OutboxEntry } from '@/offline/db';

/**
 * Single records and their ledgers, served from what the device already has.
 *
 * A list screen caches well and a record screen does not: opening a customer
 * asks for /customers/42, opening their statement asks for
 * /customers/42/ledger, and neither was ever kept. So the customer list
 * worked offline and everything reached *from* it did not — which is the
 * half of the app somebody actually uses when a customer is standing in
 * front of them asking what they owe.
 */

const PARTY_PATHS = ['/customers', '/suppliers', '/employees'];

function num(value: unknown): number {
    const parsed = typeof value === 'string' ? Number(value) : value;

    return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : 0;
}

function listRows(caches: CachedResponse[], resource: string): Record<string, unknown>[] {
    const prefix = `GET /api/v1${resource}`;
    const found: Record<string, unknown>[] = [];

    for (const cached of caches) {
        if (!cached.key.startsWith(prefix)) continue;

        // "/customers" must not answer for "/customers/42/ledger".
        const rest = cached.key.slice(prefix.length);

        if (rest !== '' && !rest.startsWith('?') && !rest.startsWith('{')) continue;

        const body = cached.body as { data?: unknown };
        const rows = Array.isArray(body?.data) ? body.data : Array.isArray(cached.body) ? cached.body : null;

        if (rows) found.push(...(rows as Record<string, unknown>[]));
    }

    return found;
}

/**
 * The record behind "/customers/42" when only the list of customers is held.
 *
 * The list row carries everything these screens draw — name, phone, balance
 * — so this is the record, not an approximation of it. Restricted to the
 * resources where that is true: a sale's row is not a sale, because it has
 * none of the lines.
 */
export function recordFromList(path: string, caches: CachedResponse[]): unknown | null {
    const match = path.match(/\/api\/v1(\/[a-z-]+)\/(-?\d+)$/);

    if (!match) return null;

    const [, resource, rawId] = match;

    if (!PARTY_PATHS.includes(resource)) return null;

    const id = Number(rawId);
    const row = listRows(caches, resource).find((entry) => entry.id === id);

    return row ? { data: row } : null;
}

/** "/api/v1/customers/42/ledger" -> { resource: '/customers', id: 42 } */
function ledgerTarget(path: string): { resource: string; id: number } | null {
    const match = path.match(/\/api\/v1(\/[a-z-]+)\/(-?\d+)\/ledger$/);

    return match ? { resource: match[1], id: Number(match[2]) } : null;
}

export function isLedgerPath(path: string): boolean {
    return ledgerTarget(path) !== null;
}

/**
 * Add payments taken during the outage to the statement.
 *
 * Taking a payment and then showing the customer a statement that does not
 * mention it is the fastest way to lose an argument about money. Debit adds
 * to what the party owes and credit takes away, exactly as the server posts
 * it, so the running balance reads the same either side of a sync.
 */
export function foldQueuedIntoLedger(
    body: unknown,
    path: string,
    entries: OutboxEntry[],
): unknown {
    const target = ledgerTarget(path);

    if (!target || body === null || typeof body !== 'object') return body;

    const page = body as { data?: unknown; current_balance?: unknown; meta?: unknown };

    if (!Array.isArray(page.data)) return body;

    const kind = target.resource === '/customers' ? 'customer' : 'supplier';

    const mine = entries.filter((entry) => {
        if (entry.method !== 'POST' || entry.state === 'conflict') return false;
        if (entry.url.split('?')[0] !== '/payments') return false;

        const payload = (entry.data ?? {}) as Record<string, unknown>;

        return payload.party_type === kind && payload.party_id === target.id;
    });

    if (mine.length === 0) return body;

    let balance = num(page.current_balance);
    const added: Record<string, unknown>[] = [];

    // Oldest first so each running balance follows the one before it.
    for (const entry of [...mine].sort((a, b) => a.createdAt - b.createdAt)) {
        const payload = (entry.data ?? {}) as Record<string, unknown>;
        const amount = num(payload.amount);
        const debit = payload.direction !== 'in';

        balance = Math.round((balance + (debit ? amount : -amount)) * 100) / 100;

        added.push({
            id: -added.length - 1,
            entry_type: debit ? 'debit' : 'credit',
            amount,
            running_balance: balance,
            description: typeof payload.description === 'string' && payload.description
                ? payload.description
                : null,
            source_type: 'Payment',
            transaction_date: new Date(entry.createdAt).toISOString(),
            archived_at: null,
            created_by: null,
            __pending: true,
        });
    }

    // The statement is newest first, which is how the screen reads it.
    const rows = [...added.reverse(), ...(page.data as Record<string, unknown>[])];
    const meta = page.meta as { total?: unknown } | undefined;

    return {
        ...page,
        data: rows,
        current_balance: balance,
        ...(meta && typeof meta.total === 'number'
            ? { meta: { ...meta, total: meta.total + added.length } }
            : {}),
    };
}
