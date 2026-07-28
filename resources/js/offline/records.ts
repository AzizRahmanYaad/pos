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

/**
 * How much a party's balance moves for everything still in the queue.
 *
 * Payments carry their own amount. Anything else — a return, so far —
 * carries a recorded effect instead, because its size depends on the record
 * as it was before the change was applied locally, which is no longer
 * available by the time anyone asks.
 */
function balanceShift(entries: OutboxEntry[], kind: string, partyId: number): number {
    return entries.reduce((total, entry) => {
        if (entry.method !== 'POST' || entry.state === 'conflict') return total;

        if (entry.effect) {
            const { partyKind, partyId: id, balanceShift: shift } = entry.effect;

            // A walk-in return records its cash and its goods but names no
            // party, so there is no balance here to move.
            return partyKind === kind && id === partyId ? total + (shift ?? 0) : total;
        }

        if (entry.url.split('?')[0] !== '/payments') return total;

        const payload = (entry.data ?? {}) as Record<string, unknown>;

        if (payload.party_type !== kind || payload.party_id !== partyId) return total;

        // Debit adds to what the party owes, credit takes away — the rule
        // the server posts every ledger entry by.
        return total + (payload.direction === 'in' ? -num(payload.amount) : num(payload.amount));
    }, 0);
}

/** The party paths whose rows carry a balance worth correcting. */
const BALANCE_PATHS: Record<string, string> = { '/customers': 'customer', '/suppliers': 'supplier' };

export function isPartyPath(path: string): boolean {
    return /\/api\/v1\/(customers|suppliers)(\/-?\d+)?(\?|\{|$)/.test(path);
}

/**
 * Take payments still in the queue off what the list says each party owes.
 *
 * The statement was corrected but the list beside it was not, so a customer
 * who had just handed over money still showed the full amount outstanding
 * on the screen the shopkeeper actually looks at. Two numbers for the same
 * debt, disagreeing, is worse than one that is merely out of date.
 */
export function foldQueuedIntoParties(body: unknown, path: string, entries: OutboxEntry[]): unknown {
    const resource = Object.keys(BALANCE_PATHS).find((key) => path.includes(`/api/v1${key}`));

    if (!resource || body === null || typeof body !== 'object') return body;

    const kind = BALANCE_PATHS[resource];

    const correct = (row: Record<string, unknown>): Record<string, unknown> => {
        if (typeof row?.id !== 'number') return row;

        const shift = balanceShift(entries, kind, row.id);

        if (shift === 0) return row;

        return {
            ...row,
            current_balance: Math.round((num(row.current_balance) + shift) * 100) / 100,
            __pending: true,
        };
    };

    const shaped = body as { data?: unknown };

    if (Array.isArray(shaped.data)) {
        return { ...shaped, data: (shaped.data as Record<string, unknown>[]).map(correct) };
    }

    if (shaped.data !== null && typeof shaped.data === 'object') {
        return { ...shaped, data: correct(shaped.data as Record<string, unknown>) };
    }

    return body;
}

/**
 * A statement for a party whose statement was never cached.
 *
 * Folding only ever corrected a ledger the device already held, and ledgers
 * are not among the screens warmed ahead of an outage — so taking a payment
 * from somebody whose statement had not been opened online left it showing
 * nothing at all. The payment was safely queued and the customer's balance
 * was right everywhere else, which made the one screen they were shown to
 * settle the argument the only screen that denied it had happened.
 *
 * Built from the party's last known balance plus everything queued against
 * them since. Where the server holds history this device never fetched, the
 * page is told the statement is partial rather than being left to imply
 * that a customer of ten years has two transactions.
 */
export function ledgerFromQueued(
    path: string,
    entries: OutboxEntry[],
    caches: CachedResponse[],
): unknown | null {
    const target = ledgerTarget(path);

    if (!target || !BALANCE_PATHS[target.resource]) return null;

    const party = listRows(caches, target.resource).find((row) => row.id === target.id);

    if (!party) return null;

    const empty = {
        data: [],
        current_balance: num(party.current_balance),
        // One page, because everything here was made on this device and
        // there is nothing further to ask the server for.
        meta: { current_page: 1, last_page: 1, per_page: 25, total: 0 },
    };

    const folded = foldQueuedIntoLedger(empty, path, entries) as { data?: unknown[] };

    // Nothing queued and nothing cached is not a statement, it is an absence
    // — and answering with an empty one would claim the party has never
    // traded. Only a party this device invented itself can honestly say that.
    if (!folded.data?.length && party.__pending !== true) return null;

    return {
        ...folded,
        /** The server may hold entries this device has never seen. */
        __partial: party.__pending !== true,
    };
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
 * What put this line on the statement, in the words the server uses.
 *
 * Read from the request rather than assumed: everything carrying a recorded
 * effect used to be labelled a sale, which was true while returns were the
 * only such thing and became a lie the moment a delivery could be received
 * offline — a supplier looking at "Sale" against their own invoice has
 * every reason to stop trusting the page.
 */
function sourceTypeOf(entry: OutboxEntry): string {
    const path = entry.url.split('?')[0];

    if (path.startsWith('/purchases')) return 'Purchase';
    if (path.startsWith('/sales')) return 'Sale';

    return 'Payment';
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

        // A return credits the customer just as a payment does, and the
        // statement is where somebody goes to check that it did.
        if (entry.effect) {
            return entry.effect.partyKind === kind && entry.effect.partyId === target.id;
        }

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

        // Receiving a delivery and settling it in one step is two postings,
        // not one netted line; anything else states a single movement.
        const lines = entry.effect?.ledger?.length
            ? entry.effect.ledger
            : [{
                amount: Math.abs(entry.effect
                    ? (entry.effect.balanceShift ?? 0)
                    : (payload.direction === 'in' ? -num(payload.amount) : num(payload.amount))),
                debit: (entry.effect
                    ? (entry.effect.balanceShift ?? 0)
                    : (payload.direction === 'in' ? -num(payload.amount) : num(payload.amount))) > 0,
                label: entry.effect?.label
                    ?? (typeof payload.description === 'string' && payload.description ? payload.description : ''),
            }];

        for (const line of lines) {
            balance = Math.round((balance + (line.debit ? line.amount : -line.amount)) * 100) / 100;

            added.push({
                id: -added.length - 1,
                entry_type: line.debit ? 'debit' : 'credit',
                amount: line.amount,
                running_balance: balance,
                description: line.label || null,
                source_type: sourceTypeOf(entry),
                transaction_date: new Date(entry.createdAt).toISOString(),
                archived_at: null,
                created_by: null,
                __pending: true,
            });
        }
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
