import type { OutboxEntry } from '@/offline/db';

/**
 * What the cash accounts hold, counting what has not been sent yet.
 *
 * The drawer balance is the one figure on screen at all times — it sits in
 * the header of every page. Left uncorrected during an outage it says the
 * shop holds what it held when the connection went, which grows steadily
 * more wrong with every sale rung up, every return handed back and every
 * customer who settles up. A till that takes money and reports the same
 * balance afterwards looks broken, and the one person who cannot check it
 * against the server is the person standing at it.
 *
 * The arithmetic mirrors what the server posts to a cash account's ledger:
 * money in is a debit, money out a credit, and the account balance moves by
 * the difference.
 */

function num(value: unknown): number {
    const parsed = typeof value === 'string' ? Number(value) : value;

    return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : 0;
}

export interface CashDelta {
    accountId: number;
    delta: number;
}

function payloadOf(entry: OutboxEntry): Record<string, unknown> {
    return (entry.data ?? {}) as Record<string, unknown>;
}

/** One account's movement, ignored unless it names an account and an amount. */
function movement(accountId: unknown, amount: number): CashDelta[] {
    if (typeof accountId !== 'number' || amount === 0) return [];

    return [{ accountId, delta: amount }];
}

/**
 * How much money one queued write moves, and out of which account.
 *
 * Returns are the exception: what a return gives back depends on the sale as
 * it stood before the return, so the amounts were worked out and recorded
 * when the return was taken rather than guessed at now.
 */
export function cashDeltas(entry: OutboxEntry): CashDelta[] {
    if (entry.method !== 'POST' || entry.state === 'conflict') return [];

    if (entry.effect?.cash) return entry.effect.cash;

    const payload = payloadOf(entry);
    const path = entry.url.split('?')[0];

    // A sale takes in whatever was tendered, across however many accounts it
    // was tendered into. What is still owed moves no cash at all.
    if (path === '/sales') {
        const payments = Array.isArray(payload.payments) ? (payload.payments as Record<string, unknown>[]) : [];

        return payments.flatMap((payment) => movement(payment.cash_account_id, num(payment.amount)));
    }

    if (path === '/payments') {
        const amount = num(payload.amount);

        return movement(payload.cash_account_id, payload.direction === 'in' ? amount : -amount);
    }

    // Including a landed cost: it is not the day's expense, but the money
    // still left the drawer, and the server credits the account either way.
    if (path === '/expenses') {
        return movement(payload.cash_account_id, -num(payload.amount));
    }

    // Receiving a purchase may settle it at the same time.
    if (/^\/purchases\/-?\d+\/receive$/.test(path)) {
        const payment = (payload.payment ?? null) as Record<string, unknown> | null;

        return payment ? movement(payment.cash_account_id, -num(payment.amount)) : [];
    }

    // Money handed to a member of staff before payday.
    if (/^\/employees\/-?\d+\/advances$/.test(path)) {
        return movement(payload.cash_account_id, -num(payload.amount));
    }

    return [];
}

export function isCashAccountPath(path: string): boolean {
    return /\/api\/v1\/cash-accounts(\/-?\d+)?(\?|\{|$)/.test(path);
}

/**
 * Correct every cash account the device holds by what is still queued.
 *
 * Applied when the accounts are *read*, so a write counts exactly while it
 * is waiting and stops counting the moment the server has it — there is no
 * window in which the same sale could be added twice.
 */
export function foldQueuedIntoCashAccounts(body: unknown, entries: OutboxEntry[]): unknown {
    if (body === null || typeof body !== 'object') return body;

    const totals = new Map<number, number>();

    for (const entry of entries) {
        for (const { accountId, delta } of cashDeltas(entry)) {
            totals.set(accountId, (totals.get(accountId) ?? 0) + delta);
        }
    }

    if (totals.size === 0) return body;

    const correct = (row: Record<string, unknown>): Record<string, unknown> => {
        if (typeof row?.id !== 'number') return row;

        const shift = totals.get(row.id);

        if (!shift) return row;

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

    if (Array.isArray(body)) {
        return (body as Record<string, unknown>[]).map(correct);
    }

    return body;
}
