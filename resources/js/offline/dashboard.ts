import { PENDING_FLAG, type CachedResponse, type OutboxEntry } from '@/offline/db';
import { costOfItems, localDate, nameById, num } from '@/offline/journal';
import { saleIdFor } from '@/offline/sales';

/**
 * The dashboard, rebuilt on the device to include what has not been sent.
 *
 * The same argument as the daily journal, one screen earlier: the dashboard
 * is the first thing a shopkeeper opens, and during an outage the cached
 * copy is the morning's figures. A shop that sold all afternoon with no
 * connection would open it and be told it took nothing today — a wrong
 * answer about money, which is worse than an obviously missing one.
 *
 * So the cached answer is treated as the day up to the moment the line went,
 * and everything still queued is added on top. The arithmetic mirrors
 * DashboardController::summary; the server wins the moment the queue drains
 * and the real figures come back.
 */

interface RecentSale {
    id: number;
    invoice_number: string;
    customer_name: string;
    grand_total: number;
    sale_date: string;
    [PENDING_FLAG]?: boolean;
}

interface Summary {
    today_sales: number;
    today_sales_count: number;
    today_profit: number;
    cash_position: number;
    receivables: number;
    payables: number;
    recent_sales?: RecentSale[];
    [PENDING_FLAG]?: boolean;
    [key: string]: unknown;
}

/** Every dashboard read that queued work can change the answer to. */
export function isDashboardPath(path: string): boolean {
    return /\/api\/v1\/dashboard\/summary(\?|\{|$)/.test(path)
        || /\/api\/v1\/reports\/sales-summary(\?|\{|$)/.test(path)
        || /\/api\/v1\/reports\/expenses-by-category(\?|\{|$)/.test(path);
}

function isSummary(body: unknown): body is Summary {
    return body !== null
        && typeof body === 'object'
        && typeof (body as Summary).today_sales === 'number';
}

/** What one queued sale is worth, valued the way the receipt valued it. */
function saleValue(entry: OutboxEntry, caches: CachedResponse[]) {
    const payload = (entry.data ?? {}) as Record<string, unknown>;
    const items = Array.isArray(payload.items) ? (payload.items as Record<string, unknown>[]) : [];
    const payments = Array.isArray(payload.payments) ? (payload.payments as Record<string, unknown>[]) : [];

    const lineTotals = items.reduce((sum, item) => sum + num(item.quantity) * num(item.unit_price), 0);
    const discount = num(payload.discount);
    const grandTotal = Math.max(0, lineTotals - discount);
    const paid = payments.reduce((sum, payment) => sum + num(payment.amount), 0);

    return {
        payload,
        grandTotal,
        paid,
        owed: Math.max(0, grandTotal - paid),
        profit: grandTotal - costOfItems(items, caches),
    };
}

/** Today's queued sales and expenses, in the order they were taken. */
function todaysWork(entries: OutboxEntry[], today: string): OutboxEntry[] {
    return entries.filter((entry) =>
        entry.method === 'POST'
        && entry.state !== 'conflict'
        && localDate(entry.createdAt) === today);
}

function pathOf(entry: OutboxEntry): string {
    return entry.url.split('?')[0];
}

function foldSummary(body: Summary, entries: OutboxEntry[], caches: CachedResponse[]): Summary {
    const today = localDate(Date.now());
    const work = todaysWork(entries, today);

    if (work.length === 0) return body;

    const next: Summary = { ...body, recent_sales: [...(body.recent_sales ?? [])] };
    let touched = false;

    for (const entry of work) {
        const path = pathOf(entry);

        if (path === '/sales') {
            const { payload, grandTotal, paid, owed, profit } = saleValue(entry, caches);

            next.today_sales += grandTotal;
            next.today_sales_count += 1;
            next.today_profit += profit;
            next.cash_position += paid;
            next.receivables += owed;

            next.recent_sales = [
                {
                    // The same temporary id the sales list gives this sale,
                    // so opening it from here reaches the same record.
                    id: saleIdFor(entry),
                    // No invoice number exists yet — the server issues that.
                    // The queue entry's own id is what the receipt showed, so
                    // the cashier can match the two up.
                    invoice_number: entry.id.slice(0, 8).toUpperCase(),
                    customer_name: nameById(caches, '/customers', payload.customer_id) ?? '—',
                    grand_total: grandTotal,
                    sale_date: new Date(entry.createdAt).toISOString(),
                    [PENDING_FLAG]: true,
                },
                ...(next.recent_sales ?? []),
            ].slice(0, 10);

            touched = true;
            continue;
        }

        if (path === '/expenses') {
            const payload = (entry.data ?? {}) as Record<string, unknown>;

            next.cash_position -= num(payload.amount);
            touched = true;
            continue;
        }

        if (path === '/payments') {
            // Money collected from a customer, or paid to a supplier: the
            // drawer moves either way, and what is owed moves with it. Read
            // the way PaymentController does — the direction says which way
            // the cash went, the party says whose balance it settles.
            const payload = (entry.data ?? {}) as Record<string, unknown>;
            const amount = num(payload.amount);

            next.cash_position += payload.direction === 'out' ? -amount : amount;

            if (payload.party_type === 'supplier') {
                next.payables = Math.max(0, next.payables - amount);
            } else {
                next.receivables = Math.max(0, next.receivables - amount);
            }

            touched = true;
        }
    }

    if (touched) next[PENDING_FLAG] = true;

    return next;
}

/**
 * The sales trend, with today's queued takings added to today's point.
 *
 * A chart that ends in a flat line at zero reads as "the shop stopped
 * selling", which during an outage is exactly backwards.
 */
function foldTrend(rows: Record<string, unknown>[], entries: OutboxEntry[], caches: CachedResponse[]) {
    const today = localDate(Date.now());
    const sales = todaysWork(entries, today).filter((entry) => pathOf(entry) === '/sales');

    if (sales.length === 0) return rows;

    const added = sales.reduce(
        (sum, entry) => {
            const { grandTotal, profit } = saleValue(entry, caches);

            return { total: sum.total + grandTotal, profit: sum.profit + profit, count: sum.count + 1 };
        },
        { total: 0, profit: 0, count: 0 },
    );

    const existing = rows.findIndex((row) => String(row.period).slice(0, 10) === today);

    if (existing === -1) {
        return [
            ...rows,
            {
                period: today,
                sale_count: added.count,
                total: added.total,
                discount: 0,
                cost: added.total - added.profit,
                profit: added.profit,
                [PENDING_FLAG]: true,
            },
        ];
    }

    return rows.map((row, index) => index !== existing ? row : {
        ...row,
        sale_count: num(row.sale_count) + added.count,
        total: num(row.total) + added.total,
        profit: num(row.profit) + added.profit,
        cost: num(row.cost) + (added.total - added.profit),
        [PENDING_FLAG]: true,
    });
}

/** Expenses by category, with today's queued spending in its own category. */
function foldExpenseCategories(rows: Record<string, unknown>[], entries: OutboxEntry[], caches: CachedResponse[]) {
    const today = localDate(Date.now());
    const queued = todaysWork(entries, today).filter((entry) => pathOf(entry) === '/expenses');

    if (queued.length === 0) return rows;

    const next = rows.map((row) => ({ ...row }));

    for (const entry of queued) {
        const payload = (entry.data ?? {}) as Record<string, unknown>;

        // A landed cost belongs to the goods it was spent on, not to the
        // month's running costs — exactly as the server treats it.
        if (payload.is_landed_cost === true) continue;

        const amount = num(payload.amount);
        const category = nameById(caches, '/expense-categories', payload.expense_category_id) ?? '—';
        const existing = next.find((row) => row.category === category);

        if (existing) {
            existing.total = num(existing.total) + amount;
            existing[PENDING_FLAG] = true;
        } else {
            next.push({ category, total: amount, [PENDING_FLAG]: true });
        }
    }

    return next;
}

export function foldQueuedIntoDashboard(
    body: unknown,
    path: string,
    entries: OutboxEntry[],
    caches: CachedResponse[],
): unknown {
    if (body === null || typeof body !== 'object') return body;

    if (isSummary(body)) return foldSummary(body, entries, caches);

    const shaped = body as { rows?: unknown };

    if (!Array.isArray(shaped.rows)) return body;

    const rows = shaped.rows as Record<string, unknown>[];

    if (path.includes('/reports/sales-summary')) {
        return { ...shaped, rows: foldTrend(rows, entries, caches) };
    }

    if (path.includes('/reports/expenses-by-category')) {
        return { ...shaped, rows: foldExpenseCategories(rows, entries, caches) };
    }

    return body;
}
