import axios, { type AxiosError, type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/i18n';
import {
    allCaches,
    applyWriteLocally,
    refundShare,
    enqueue,
    pendingEntries,
    readCacheForPath,
    writeCache,
    type CachedResponse,
    type OutboxEntry,
} from '@/offline/db';
import { foldQueuedIntoCashAccounts, isCashAccountPath } from '@/offline/cash';
import { foldQueuedIntoDashboard, isDashboardPath } from '@/offline/dashboard';
import { foldQueuedIntoJournal, isDatedReport } from '@/offline/journal';
import { buildQueuedPurchase, purchaseIdFor, queuedPurchaseDetail } from '@/offline/purchases';
import { buildQueuedSale, queuedSaleDetail, saleIdFor } from '@/offline/sales';
import { foldQueuedIntoStock, isStockPath } from '@/offline/stock';
import {
    foldQueuedIntoLedger,
    foldQueuedIntoParties,
    isLedgerPath,
    isPartyPath,
    ledgerFromQueued,
    recordFromList,
} from '@/offline/records';
import { IDEMPOTENCY_HEADER } from '@/offline/rawClient';
import { reportReachable, refreshUnsentCount, useSyncStore } from '@/offline/syncStore';

const LAST_USER_KEY = 'asan-hesab:last-user';

/**
 * Who this device is caching and queueing for.
 *
 * Remembered across restarts on purpose: opening the app cold with no
 * network has to answer "who is signed in?" from the device, or the very
 * first request — /auth/me — has nobody to be served on behalf of, and the
 * whole offline session dies at the login screen.
 */
let currentUserId: number | null = readLastUser();

function readLastUser(): number | null {
    try {
        const stored = window.localStorage.getItem(LAST_USER_KEY);

        return stored ? Number(stored) : null;
    } catch {
        return null;
    }
}

export function setOfflineUser(userId: number | null): void {
    currentUserId = userId;

    try {
        if (userId === null) window.localStorage.removeItem(LAST_USER_KEY);
        else window.localStorage.setItem(LAST_USER_KEY, String(userId));
    } catch {
        // Storage denied: offline still works for this session only.
    }
}

export function offlineUserId(): number | null {
    return currentUserId;
}

/** crypto.randomUUID needs a secure context; keep working without one. */
function newId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => {
        const n = Number(c);

        return (n ^ (Math.random() * 16) >> (n / 4)).toString(16);
    });
}

/** A failure with no response is the network; a 4xx is an answer. */
function isNetworkFailure(error: AxiosError): boolean {
    return error.response === undefined && error.code !== 'ERR_CANCELED';
}

function cacheKey(config: InternalAxiosRequestConfig): string {
    const params = config.params ? JSON.stringify(config.params) : '';

    return `GET ${config.baseURL ?? ''}${config.url ?? ''}${params}`;
}

/** Endpoints whose answers are worthless or misleading when stale. */
function isCacheable(config: InternalAxiosRequestConfig): boolean {
    const url = config.url ?? '';

    if (config.responseType === 'blob') return false;

    // The queue is local; asking the server about it while offline is
    // meaningless, and a stale copy would be actively misleading.
    return !url.startsWith('/auth/logout');
}

/**
 * What the user was doing, for the "waiting to sync" list. Derived from the
 * request rather than passed in, so no call site has to remember to label
 * itself and none can be forgotten.
 */
function describe(method: string, url: string): string {
    const resource = url.replace(/^\//, '').split('/')[0]?.replace(/-/g, ' ') ?? 'record';
    const verbKey = { POST: 'created', PUT: 'updated', PATCH: 'updated', DELETE: 'deleted' }[method] ?? 'changed';

    return i18n.t(`offline.pending_label.${verbKey}`, {
        resource: i18n.t(`activity_page.modules.${url.replace(/^\//, '').split('/')[0]}`, resource),
        defaultValue: `${resource} ${verbKey}`,
    });
}

/**
 * Give every write its own identity before it is sent.
 *
 * This has to happen on the *first* attempt, not only on a replay. A
 * request that times out may still have reached the server and been
 * applied — the answer was simply lost on the way back — and replaying it
 * without the original key would ring the sale up a second time. Carrying
 * the key from the start means the server recognises the replay and hands
 * back the original answer instead.
 */
function stampIdempotencyKey(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
    const method = (config.method ?? 'get').toUpperCase();

    if (method === 'GET' || method === 'HEAD') return config;

    if (!config.headers[IDEMPOTENCY_HEADER]) {
        config.headers[IDEMPOTENCY_HEADER] = newId();
    }

    return config;
}

/**
 * When the device already knows there is no network, do not spend twenty
 * seconds proving it. A cashier with a customer waiting should see the sale
 * accepted at once, not watch a spinner until a socket gives up.
 *
 * The timeout on the client is still the safety net for the other case: a
 * connection that is up but leads nowhere, which fails slowly or not at all.
 */
function failFastWhenKnownOffline(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        // Replace the dispatcher rather than throwing or shortening the
        // timeout. Throwing inside a request interceptor is handled
        // inconsistently by axios depending on whether the chain is
        // synchronous, and a timeout only helps once the request has
        // actually been dispatched — a request the browser is holding for a
        // network that does not exist may simply wait, and did. Swapping the
        // adapter guarantees the failure happens here, immediately, and
        // arrives at the response handler by the normal route.
        config.adapter = () => Promise.reject(new axios.AxiosError(
            'Device reports no network connection.',
            axios.AxiosError.ERR_NETWORK,
            config,
        ));
    }

    return config;
}

/**
 * Add what this device has done but not yet sent to a cached answer.
 *
 * Only the daily journal needs this so far, and it needs it badly: a shop
 * that sold all afternoon with no connection would otherwise open the
 * journal at closing time and be told the day was empty.
 */
async function withQueuedWork(body: unknown, path: string, userId: number): Promise<unknown> {
    const dated = isDatedReport(path);
    const ledger = isLedgerPath(path);
    const party = isPartyPath(path);
    const cash = isCashAccountPath(path);
    const stock = isStockPath(path);
    const dashboard = isDashboardPath(path);

    if (!dated && !ledger && !party && !cash && !stock && !dashboard) return body;

    const entries = await pendingEntries(userId);

    if (ledger) return foldQueuedIntoLedger(body, path, entries);
    if (party) return foldQueuedIntoParties(body, path, entries);
    if (cash) return foldQueuedIntoCashAccounts(body, entries);
    if (stock) return foldQueuedIntoStock(body, path, entries, await allCaches(userId));
    if (dashboard) return foldQueuedIntoDashboard(body, path, entries, await allCaches(userId));

    return foldQueuedIntoJournal(body, entries, await allCaches(userId));
}

/**
 * The full record behind a queued create, for the screens that draw one.
 *
 * Only the writes whose payload is not already the record need this: a
 * customer's payload *is* the customer, but a sale's payload is a basket
 * and a purchase's is a delivery note, and both screens draw totals that
 * only exist once somebody works them out.
 */
function buildQueuedRecord(
    entry: OutboxEntry,
    caches: CachedResponse[],
): Record<string, unknown> | null {
    return buildQueuedSale(entry, caches) ?? buildQueuedPurchase(entry, caches);
}

/**
 * Everything a queued return does to the books, measured before the local
 * copy of the sale is changed by that same return.
 *
 * Three separate answers, all functions of the sale as it stands right now:
 * what the customer stops owing, what leaves the drawer, and what the day
 * stops having sold. Once the return is applied locally the sale no longer
 * remembers what it was, so all three are worked out here or not at all.
 */
async function refundEffect(entry: OutboxEntry, userId: number): Promise<OutboxEntry['effect'] | null> {
    const match = entry.url.split('?')[0].match(/^\/sales\/(-?\d+)\/refund$/);

    if (!match) return null;

    const saleId = Number(match[1]);
    const caches = await allCaches(userId);

    let sale = caches
        .filter((cached) => cached.key === `GET /api/v1/sales/${saleId}`)
        .map((cached) => (cached.body as { data?: unknown })?.data as Record<string, unknown> | undefined)
        .find(Boolean) ?? null;

    if (!sale) {
        const queued = (await pendingEntries(userId)).find((row) => row.method === 'POST'
            && row.url.split('?')[0] === '/sales'
            && saleIdFor(row) === saleId);

        sale = queued ? buildQueuedSale(queued, caches) : null;
    }

    if (!sale) return null;

    const payload = (entry.data ?? {}) as Record<string, unknown>;
    const { fraction, dueForgiven } = refundShare(sale, payload);
    const label = typeof sale.invoice_number === 'string' ? `Refund ${sale.invoice_number}` : 'Refund';

    // Given back into the accounts it was taken into, in the same proportion
    // — the split RefundSaleAction makes when it credits each tender.
    const payments = Array.isArray(sale.payments) ? (sale.payments as Record<string, unknown>[]) : [];
    const cash = payments
        .map((payment) => ({
            accountId: payment.cash_account_id,
            delta: -(Math.round(Number(payment.amount) * fraction * 100) / 100),
        }))
        .filter((row): row is { accountId: number; delta: number } =>
            typeof row.accountId === 'number' && row.delta !== 0);

    // The goods are their own effect, alongside the money — kept at the top
    // level rather than inside the trading figures, because what comes back
    // onto the shelf is not a figure about a day, and folding it in there
    // was enough to make the stock count silently ignore every return.
    const { refundValue, refundedCost, stock } = refundedTrading(sale, payload);

    return {
        // A walk-in has nobody to credit, but the money and the goods still
        // moved, so the rest of the effect is recorded regardless.
        ...(typeof sale.customer_id === 'number' && dueForgiven > 0
            ? { partyKind: 'customer' as const, partyId: sale.customer_id, balanceShift: -dueForgiven }
            : {}),
        label,
        cash,
        stock,
        refund: {
            saleDate: typeof sale.sale_date === 'string' ? sale.sale_date : null,
            refundValue,
            refundedCost,
            dueForgiven,
        },
    };
}

/**
 * What receiving a delivery does to the books, measured before the local
 * copy of the purchase is changed by that same receipt.
 *
 * Receiving is where a purchase finally counts: a draft owes nobody
 * anything, and only on receipt does the supplier get credited, the day get
 * its purchase, and — if it is settled in the same step — the drawer get
 * lighter.
 */
async function receiveEffect(entry: OutboxEntry, userId: number): Promise<OutboxEntry['effect'] | null> {
    const match = entry.url.split('?')[0].match(/^\/purchases\/(-?\d+)\/receive$/);

    if (!match) return null;

    const purchaseId = Number(match[1]);
    const caches = await allCaches(userId);

    const cached = caches
        .filter((entry) => entry.key === `GET /api/v1/purchases/${purchaseId}`)
        .map((entry) => (entry.body as { data?: unknown })?.data as Record<string, unknown> | undefined)
        .find(Boolean) ?? null;

    let purchase = cached;

    if (!purchase) {
        const queued = (await pendingEntries(userId)).find((row) => row.method === 'POST'
            && row.url.split('?')[0] === '/purchases'
            && purchaseIdFor(row) === purchaseId);

        purchase = queued ? buildQueuedPurchase(queued, caches) : null;
    }

    // A purchase the device holds only as a list row still carries the
    // figures that matter here, and a delivery must not go unrecorded just
    // because its detail screen was never opened.
    if (!purchase) {
        purchase = caches
            .flatMap((entry) => {
                if (!entry.key.startsWith('GET /api/v1/purchases')) return [];
                const body = entry.body as { data?: unknown };

                return Array.isArray(body?.data) ? (body.data as Record<string, unknown>[]) : [];
            })
            .find((row) => row.id === purchaseId) ?? null;
    }

    if (!purchase) return null;

    const payload = (entry.data ?? {}) as Record<string, unknown>;
    const payment = (payload.payment ?? null) as Record<string, unknown> | null;
    const paid = payment ? Number(payment.amount) || 0 : 0;
    const grandTotal = Number(purchase.grand_total) || 0;
    const label = typeof purchase.purchase_number === 'string'
        ? `Purchase ${purchase.purchase_number}`
        : 'Purchase';

    // Credit for the goods, debit for anything handed over — the two
    // postings the server makes, kept apart so the statement reconciles.
    const ledger = [
        ...(grandTotal > 0 ? [{ amount: grandTotal, debit: false, label }] : []),
        ...(paid > 0 ? [{ amount: paid, debit: true, label: `Payment for ${purchase.purchase_number ?? ''}`.trim() }] : []),
    ];

    return {
        ...(typeof purchase.supplier_id === 'number' && ledger.length > 0
            ? { partyKind: 'supplier' as const, partyId: purchase.supplier_id, balanceShift: paid - grandTotal }
            : {}),
        label,
        ledger,
        cash: payment && typeof payment.cash_account_id === 'number' && paid > 0
            ? [{ accountId: payment.cash_account_id, delta: -paid }]
            : [],
        purchase: {
            // The day the purchase is *dated*, which is the day the server
            // counts it on, whenever it was actually booked in.
            purchaseDate: typeof purchase.purchase_date === 'string' ? purchase.purchase_date : null,
            grandTotal,
            supplierPaid: paid,
        },
        // The goods themselves, arriving into the warehouse the purchase
        // named. Read now, while the lines still say what was ordered rather
        // than what has just been marked received.
        stock: (Array.isArray(purchase.items) ? (purchase.items as Record<string, unknown>[]) : [])
            .filter((item) => typeof item.product_id === 'number' && (Number(item.quantity) || 0) > 0)
            .map((item) => ({
                productId: item.product_id as number,
                warehouseId: typeof purchase.warehouse_id === 'number' ? purchase.warehouse_id : null,
                quantity: Number(item.quantity) || 0,
            })),
    };
}

/**
 * What paying a payroll run does to the money.
 *
 * The amount is the run's own net total, which lives on the run rather than
 * in the request — the request names only the account to pay from. So it is
 * read here, while the run is still unpaid and still says what it is worth.
 */
async function payrollEffect(entry: OutboxEntry, userId: number): Promise<OutboxEntry['effect'] | null> {
    const match = entry.url.split('?')[0].match(/^\/payroll-runs\/(-?\d+)\/pay$/);

    if (!match) return null;

    const runId = Number(match[1]);
    const caches = await allCaches(userId);

    const run = caches
        .filter((cached) => cached.key === `GET /api/v1/payroll-runs/${runId}`)
        .map((cached) => (cached.body as { data?: unknown })?.data as Record<string, unknown> | undefined)
        .find(Boolean)
        ?? caches
            .flatMap((cached) => {
                if (!cached.key.startsWith('GET /api/v1/payroll-runs')) return [];
                const body = cached.body as { data?: unknown };

                return Array.isArray(body?.data) ? (body.data as Record<string, unknown>[]) : [];
            })
            .find((row) => row.id === runId)
        ?? null;

    if (!run) return null;

    const payload = (entry.data ?? {}) as Record<string, unknown>;
    const total = Number(run.total_net_pay) || 0;

    if (total <= 0 || typeof payload.cash_account_id !== 'number') return null;

    const period = [run.period_month, run.period_year].every((part) => typeof part === 'number')
        ? ` ${run.period_month}/${run.period_year}`
        : '';

    return {
        label: `Payroll${period}`,
        cash: [{ accountId: payload.cash_account_id, delta: -total }],
        payroll: { total },
    };
}

/**
 * What the returned goods were sold for and what they had cost.
 *
 * Both come off the day the sale was rung up on, exactly as the server's
 * journal nets refunded quantities out of that day's takings and cost of
 * goods — so the profit falls by the margin the shop no longer made.
 */
function refundedTrading(
    sale: Record<string, unknown>,
    payload: Record<string, unknown>,
): { refundValue: number; refundedCost: number; stock: NonNullable<OutboxEntry['effect']>['stock'] } {
    const asked = Array.isArray(payload.items) ? (payload.items as Record<string, unknown>[]) : null;
    const items = Array.isArray(sale.items) ? (sale.items as Record<string, unknown>[]) : [];
    const warehouseId = typeof sale.warehouse_id === 'number' ? sale.warehouse_id : null;

    let refundValue = 0;
    let refundedCost = 0;
    const stock: NonNullable<NonNullable<OutboxEntry['effect']>['stock']> = [];

    for (const item of items) {
        const quantity = Number(item.quantity) || 0;
        const already = Number(item.refunded_quantity) || 0;
        const asking = asked === null
            ? quantity - already
            : Number(asked.find((row) => row.sale_item_id === item.id)?.quantity ?? 0);

        if (quantity <= 0 || asking <= 0) continue;

        refundValue += (Number(item.line_total) || 0) * (asking / quantity);
        refundedCost += (Number(item.cost_price_snapshot) || 0) * asking;

        // Back on the shelf, into the warehouse it left from.
        if (typeof item.product_id === 'number') {
            stock.push({ productId: item.product_id, warehouseId, quantity: asking });
        }
    }

    return {
        refundValue: Math.round(refundValue * 100) / 100,
        refundedCost: Math.round(refundedCost * 100) / 100,
        stock,
    };
}

/**
 * Attach offline behaviour to an axios instance.
 *
 * Reads fall back to the last answer this device received. Writes that
 * cannot reach the server are put in a durable queue and reported as
 * accepted, so the cashier's next customer is not kept waiting on a router.
 */
export function installOfflineInterceptors(client: AxiosInstance): void {
    client.interceptors.request.use(stampIdempotencyKey);
    client.interceptors.request.use(failFastWhenKnownOffline);

    client.interceptors.response.use(
        async (response: AxiosResponse) => {
            reportReachable(true);

            const config = response.config as InternalAxiosRequestConfig;

            if (config.method?.toUpperCase() === 'GET' && currentUserId !== null && isCacheable(config)) {
                await writeCache({
                    key: cacheKey(config),
                    userId: currentUserId,
                    status: response.status,
                    body: response.data,
                    fetchedAt: Date.now(),
                });
            }

            return response;
        },
        async (error: AxiosError) => {
            if (!isNetworkFailure(error) || !error.config) {
                return Promise.reject(error);
            }

            reportReachable(false);

            const config = error.config as InternalAxiosRequestConfig;
            const method = (config.method ?? 'get').toUpperCase();

            if (currentUserId === null) {
                // Nobody is signed in yet — there is nothing to serve and
                // nothing to queue against.
                return Promise.reject(error);
            }

            if (method === 'GET') {
                const path = `${config.baseURL ?? ''}${config.url ?? ''}`;
                const hit = await readCacheForPath(
                    cacheKey(config),
                    path,
                    currentUserId,
                    isDatedReport(path),
                );

                if (hit) {
                    return {
                        data: await withQueuedWork(hit.body, path, currentUserId),
                        status: hit.status,
                        statusText: 'OK (offline)',
                        headers: {},
                        config,
                        request: undefined,
                        // Screens that care can say "as of an hour ago".
                        fromCache: true,
                        cachedAt: hit.fetchedAt,
                    } as AxiosResponse;
                }

                // Nothing cached. It may still be a sale this device took
                // itself and the server has never seen — opening it is the
                // first thing a cashier does after taking one offline.
                const caches = await allCaches(currentUserId);
                const unsent = await pendingEntries(currentUserId);
                const queued = queuedSaleDetail(path, unsent, caches)
                    // A delivery entered during the outage, which has to be
                    // openable or it can never be received.
                    ?? queuedPurchaseDetail(path, unsent, caches)
                    // A customer or supplier the device holds in a list but
                    // never fetched on its own. The row is the record.
                    ?? foldQueuedIntoParties(recordFromList(path, caches), path, unsent)
                    // Their statement, which nothing warms ahead of an
                    // outage — so a payment taken during one had nowhere to
                    // appear on the very screen it would be queried from.
                    ?? ledgerFromQueued(path, unsent, caches);

                if (queued !== null) {
                    return {
                        data: queued,
                        status: 200,
                        statusText: 'OK (offline)',
                        headers: {},
                        config,
                        request: undefined,
                        fromCache: true,
                    } as AxiosResponse;
                }

                return Promise.reject(error);
            }

            // Signing in and out are not changes to the business; queuing
            // them would replay a stale login later and, worse, made the
            // login screen report a perfectly good password as invalid.
            const isAuthCall = (config.url ?? '').startsWith('/auth/');

            if (!isAuthCall && (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE')) {
                const entry: OutboxEntry = {
                    // The key the request went out with — so if it did in
                    // fact land before the connection died, the replay is
                    // recognised rather than repeated.
                    id: String(config.headers?.[IDEMPOTENCY_HEADER] ?? newId()),
                    userId: currentUserId,
                    method,
                    url: config.url ?? '',
                    data: parseBody(config.data),
                    label: describe(method, config.url ?? ''),
                    createdAt: Date.now(),
                    state: 'pending',
                    attempts: 0,
                };

                // Before anything local is patched: what a return forgives,
                // and what a receipt puts on the supplier's account, both
                // depend on the record as it stands *now* — and
                // applyWriteLocally is about to change it.
                entry.effect = await refundEffect(entry, currentUserId)
                    ?? await receiveEffect(entry, currentUserId)
                    ?? await payrollEffect(entry, currentUserId)
                    ?? undefined;

                try {
                    await enqueue(entry);
                } catch {
                    // Without a queue we cannot honestly claim the change was
                    // kept, so the failure goes back to the caller.
                    return Promise.reject(error);
                }

                // Show it on the screen that made it. Queuing silently is
                // indistinguishable, to the user, from being ignored.
                // A record built from its payload alone lists as 0.00 with no
                // status, because the payload carries none of the figures the
                // list draws. This builds the record the server would have.
                const optimistic = await applyWriteLocally(entry, buildQueuedRecord);

                await refreshUnsentCount(currentUserId);

                // The change is safely on the device. Telling the caller it
                // succeeded is what lets the till keep serving customers,
                // and handing back the record itself is what lets screens
                // that expect one carry on as they do online.
                return {
                    data: { data: optimistic, queued: true, queue_id: entry.id },
                    status: 202,
                    statusText: 'Queued offline',
                    headers: { [IDEMPOTENCY_HEADER]: entry.id },
                    config,
                    request: undefined,
                    queuedOffline: true,
                } as AxiosResponse;
            }

            return Promise.reject(error);
        },
    );
}

function parseBody(data: unknown): unknown {
    if (typeof data !== 'string') return data;

    try {
        return JSON.parse(data);
    } catch {
        return data;
    }
}

/** Drain whenever the browser thinks the network is back, and on load. */
export function watchConnection(getUserId: () => number | null): () => void {
    const onOnline = () => {
        const userId = getUserId();

        reportReachable(true);

        if (userId !== null) void useSyncStore.getState().sync(userId);
    };

    const onOffline = () => reportReachable(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // The browser's own event is not always fired (a router that answers
    // DHCP but routes nothing), so also try periodically while anything is
    // waiting.
    const timer = window.setInterval(() => {
        const userId = getUserId();
        const { unsent, status } = useSyncStore.getState();

        if (userId !== null && unsent > 0 && status !== 'syncing') {
            void useSyncStore.getState().sync(userId);
        }
    }, 30_000);

    return () => {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
        window.clearInterval(timer);
    };
}

export function isQueuedResponse(response: unknown): boolean {
    return axios.isAxiosError(response) === false
        && typeof response === 'object'
        && response !== null
        && 'queuedOffline' in response;
}
