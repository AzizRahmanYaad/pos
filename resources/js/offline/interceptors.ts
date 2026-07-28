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
    type OutboxEntry,
} from '@/offline/db';
import { foldQueuedIntoCashAccounts, isCashAccountPath } from '@/offline/cash';
import { foldQueuedIntoJournal, isDatedReport } from '@/offline/journal';
import { buildQueuedSale, queuedSaleDetail, saleIdFor } from '@/offline/sales';
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

    if (!dated && !ledger && !party && !cash) return body;

    const entries = await pendingEntries(userId);

    if (ledger) return foldQueuedIntoLedger(body, path, entries);
    if (party) return foldQueuedIntoParties(body, path, entries);
    if (cash) return foldQueuedIntoCashAccounts(body, entries);

    return foldQueuedIntoJournal(body, entries, await allCaches(userId));
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

    return {
        // A walk-in has nobody to credit, but the money and the goods still
        // moved, so the rest of the effect is recorded regardless.
        ...(typeof sale.customer_id === 'number' && dueForgiven > 0
            ? { partyKind: 'customer' as const, partyId: sale.customer_id, balanceShift: -dueForgiven }
            : {}),
        label,
        cash,
        refund: {
            saleDate: typeof sale.sale_date === 'string' ? sale.sale_date : null,
            ...refundedTrading(sale, payload),
            dueForgiven,
        },
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
): { refundValue: number; refundedCost: number } {
    const asked = Array.isArray(payload.items) ? (payload.items as Record<string, unknown>[]) : null;
    const items = Array.isArray(sale.items) ? (sale.items as Record<string, unknown>[]) : [];

    let refundValue = 0;
    let refundedCost = 0;

    for (const item of items) {
        const quantity = Number(item.quantity) || 0;
        const already = Number(item.refunded_quantity) || 0;
        const asking = asked === null
            ? quantity - already
            : Number(asked.find((row) => row.sale_item_id === item.id)?.quantity ?? 0);

        if (quantity <= 0 || asking <= 0) continue;

        refundValue += (Number(item.line_total) || 0) * (asking / quantity);
        refundedCost += (Number(item.cost_price_snapshot) || 0) * asking;
    }

    return {
        refundValue: Math.round(refundValue * 100) / 100,
        refundedCost: Math.round(refundedCost * 100) / 100,
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

                // Before anything local is patched: a return's effect on what
                // the customer owes depends on the sale as it stands *now*,
                // and applyWriteLocally is about to change that.
                entry.effect = await refundEffect(entry, currentUserId) ?? undefined;

                try {
                    await enqueue(entry);
                } catch {
                    // Without a queue we cannot honestly claim the change was
                    // kept, so the failure goes back to the caller.
                    return Promise.reject(error);
                }

                // Show it on the screen that made it. Queuing silently is
                // indistinguishable, to the user, from being ignored.
                // A sale built from its payload alone lists as 0.00 with no
                // status, because the payload carries none of the figures the
                // list draws. This builds the record the server would have.
                const optimistic = await applyWriteLocally(entry, buildQueuedSale);

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
