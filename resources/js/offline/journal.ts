import { PENDING_FLAG, type CachedResponse, type OutboxEntry } from '@/offline/db';

/**
 * The daily journal, rebuilt on the device to include what has not been sent.
 *
 * Every other screen can be made to work offline by remembering what the
 * server last said. The journal cannot: it is the day's own takings, and a
 * shop that sold all afternoon with no connection would open it and be told
 * the day was empty. That is worse than no answer at all — it is a wrong
 * one, about money, at closing time.
 *
 * So the cached copy is treated as the day up to the moment the connection
 * went, and everything still waiting in the queue is added on top. The
 * arithmetic here deliberately mirrors ReportController::computeDailyJournal;
 * where the two could drift, the server wins as soon as the queue drains and
 * the real journal is fetched again.
 */

export interface JournalTransaction {
    type: 'sale' | 'purchase' | 'customer_collection' | 'supplier_payment' | 'expense';
    time: string;
    description: string;
    amount: number;
    direction: 'in' | 'out';
    [PENDING_FLAG]?: boolean;
}

export interface Journal {
    date: string;
    sales_total: number;
    credit_sales_total: number;
    customer_collections_total: number;
    purchases_total: number;
    supplier_payments_total: number;
    discounts_total: number;
    expenses_total: number;
    salaries_total: number;
    cash_in_total: number;
    cash_out_total: number;
    net_cash_movement: number;
    profit_or_loss: number;
    transactions: JournalTransaction[];
}

function isJournal(body: unknown): body is Journal {
    return body !== null
        && typeof body === 'object'
        && Array.isArray((body as { transactions?: unknown }).transactions);
}

/** Local calendar date, which is the day the user means by "today". */
export function localDate(at: number): string {
    const when = new Date(at);
    const pad = (n: number) => String(n).padStart(2, '0');

    return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`;
}

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

function nameById(caches: CachedResponse[], path: string, id: unknown): string | null {
    if (typeof id !== 'number') return null;

    const match = rowsOf(caches, path).find((row) => row.id === id);

    return typeof match?.name === 'string' ? match.name : null;
}

/**
 * What a sale costs the shop, so the day's profit is not simply its takings.
 *
 * The server snapshots each line's cost at the till. Offline the nearest
 * truth available is what the device was last told each product costs, which
 * is the same number the till itself shows.
 */
function costOfItems(items: Record<string, unknown>[], caches: CachedResponse[]): number {
    const products = rowsOf(caches, '/products');

    return items.reduce((total, item) => {
        const product = products.find((row) => row.id === item.product_id);
        const unitCost = num(product?.average_cost) || num(product?.default_cost);

        return total + unitCost * num(item.quantity);
    }, 0);
}

function foldSale(journal: Journal, entry: OutboxEntry, caches: CachedResponse[]): void {
    const payload = (entry.data ?? {}) as Record<string, unknown>;
    const items = Array.isArray(payload.items) ? (payload.items as Record<string, unknown>[]) : [];
    const payments = Array.isArray(payload.payments) ? (payload.payments as Record<string, unknown>[]) : [];

    const lineTotals = items.reduce((sum, item) => sum + num(item.quantity) * num(item.unit_price), 0);
    const discount = num(payload.discount);
    const grandTotal = Math.max(0, lineTotals - discount);
    const paid = payments.reduce((sum, payment) => sum + num(payment.amount), 0);

    journal.sales_total += lineTotals;
    journal.discounts_total += discount;
    journal.credit_sales_total += Math.max(0, grandTotal - paid);
    journal.cash_in_total += paid;
    journal.profit_or_loss += lineTotals - discount - costOfItems(items, caches);

    journal.transactions.push({
        type: 'sale',
        time: new Date(entry.createdAt).toISOString(),
        // No invoice number exists yet — the server issues that. The queue
        // entry's own id is what the receipt showed, so they match up.
        description: `${entry.id.slice(0, 8).toUpperCase()} — ${
            nameById(caches, '/customers', payload.customer_id) ?? 'Walk-in'
        }`,
        amount: grandTotal,
        direction: 'in',
        [PENDING_FLAG]: true,
    });
}

function foldExpense(journal: Journal, entry: OutboxEntry, caches: CachedResponse[]): void {
    const payload = (entry.data ?? {}) as Record<string, unknown>;
    const amount = num(payload.amount);

    // A landed cost belongs to the goods it was spent on, not to the day —
    // exactly as the server treats it.
    if (payload.is_landed_cost !== true) {
        journal.expenses_total += amount;
        journal.profit_or_loss -= amount;
    }

    journal.cash_out_total += amount;

    journal.transactions.push({
        type: 'expense',
        time: new Date(entry.createdAt).toISOString(),
        description: nameById(caches, '/expense-categories', payload.expense_category_id) ?? 'Expense',
        amount,
        direction: 'out',
        [PENDING_FLAG]: true,
    });
}

function foldPayment(journal: Journal, entry: OutboxEntry, caches: CachedResponse[]): void {
    const payload = (entry.data ?? {}) as Record<string, unknown>;
    const amount = num(payload.amount);
    const incoming = payload.direction === 'in';
    const fromCustomer = payload.party_type === 'customer';

    if (incoming && fromCustomer) {
        journal.customer_collections_total += amount;
        journal.cash_in_total += amount;
    } else if (!incoming && payload.party_type === 'supplier') {
        journal.supplier_payments_total += amount;
        journal.cash_out_total += amount;
    } else {
        return;
    }

    const party = nameById(caches, fromCustomer ? '/customers' : '/suppliers', payload.party_id) ?? '';

    journal.transactions.push({
        type: incoming ? 'customer_collection' : 'supplier_payment',
        time: new Date(entry.createdAt).toISOString(),
        description: incoming ? `Collection from ${party}` : `Payment to ${party}`,
        amount,
        direction: incoming ? 'in' : 'out',
        [PENDING_FLAG]: true,
    });
}

/**
 * Take a queued return back out of the day.
 *
 * The server does this by netting refunded quantities out of the day's
 * takings and cost of goods, which lands the loss on the day the goods were
 * *sold* — not the day they came back. The cash, though, leaves the drawer
 * today, because that is when the ledger entry is posted. So a return of
 * this morning's sale moves everything, and a return of last week's moves
 * only the money: the same split the server makes, and the reason a return
 * cannot simply be a sale with a minus sign.
 */
function foldRefund(journal: Journal, entry: OutboxEntry): void {
    const refund = entry.effect?.refund;

    if (!refund) return;

    // Cash out lands on the journal being read, which is the day the return
    // was taken — the caller has already established that much.
    for (const { delta } of entry.effect?.cash ?? []) {
        if (delta < 0) journal.cash_out_total += -delta;
        else journal.cash_in_total += delta;
    }

    const soldOn = refund.saleDate ? localDate(Date.parse(refund.saleDate)) : null;

    if (soldOn !== journal.date) return;

    journal.sales_total -= refund.refundValue;
    journal.credit_sales_total = Math.max(0, journal.credit_sales_total - refund.dueForgiven);
    journal.profit_or_loss -= refund.refundValue - refund.refundedCost;
}

/** Writes that change a day's money. Anything else leaves the journal alone. */
const FOLDERS: Record<string, (j: Journal, e: OutboxEntry, c: CachedResponse[]) => void> = {
    '/sales': foldSale,
    '/expenses': foldExpense,
    '/payments': foldPayment,
};

/** "/sales/12/refund" — done to a sale, not a new one. */
function folderFor(url: string): ((j: Journal, e: OutboxEntry, c: CachedResponse[]) => void) | undefined {
    const path = url.split('?')[0];

    if (/^\/sales\/-?\d+\/refund$/.test(path)) return foldRefund;

    return FOLDERS[path];
}

/**
 * Add everything still queued for this day to the journal the server last
 * gave us.
 *
 * Applied when the journal is *read*, not when the write is made. A queued
 * sale therefore appears while it is waiting and disappears the moment it
 * has been accepted — at which point the server's own copy already contains
 * it, and there is no window in which it could be counted twice.
 */
export function foldQueuedIntoJournal(
    body: unknown,
    entries: OutboxEntry[],
    caches: CachedResponse[],
): unknown {
    if (!isJournal(body)) return body;

    const journal: Journal = {
        ...body,
        transactions: [...body.transactions],
    };

    let folded = 0;

    for (const entry of entries) {
        if (entry.method !== 'POST' || entry.state === 'conflict') continue;
        if (localDate(entry.createdAt) !== journal.date) continue;

        const fold = folderFor(entry.url);

        if (!fold) continue;

        fold(journal, entry, caches);
        folded += 1;
    }

    if (folded === 0) return body;

    journal.net_cash_movement = journal.cash_in_total - journal.cash_out_total;
    journal.transactions.sort((a, b) => a.time.localeCompare(b.time));

    const round = (value: number) => Math.round(value * 100) / 100;

    return {
        ...journal,
        sales_total: round(journal.sales_total),
        credit_sales_total: round(journal.credit_sales_total),
        customer_collections_total: round(journal.customer_collections_total),
        purchases_total: round(journal.purchases_total),
        supplier_payments_total: round(journal.supplier_payments_total),
        discounts_total: round(journal.discounts_total),
        expenses_total: round(journal.expenses_total),
        salaries_total: round(journal.salaries_total),
        cash_in_total: round(journal.cash_in_total),
        cash_out_total: round(journal.cash_out_total),
        net_cash_movement: round(journal.net_cash_movement),
        profit_or_loss: round(journal.profit_or_loss),
        /** So the screen can say plainly that some of this is not sent yet. */
        unsent_count: folded,
    };
}

/** Reports keyed by a date must never be answered with a different one. */
export function isDatedReport(path: string): boolean {
    return path.includes('/reports/daily-journal');
}
