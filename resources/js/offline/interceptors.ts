import axios, { type AxiosError, type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/i18n';
import { applyWriteLocally, enqueue, readCacheForPath, writeCache, type OutboxEntry } from '@/offline/db';
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
                const hit = await readCacheForPath(
                    cacheKey(config),
                    `${config.baseURL ?? ''}${config.url ?? ''}`,
                    currentUserId,
                );

                if (hit) {
                    return {
                        data: hit.body,
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

                return Promise.reject(error);
            }

            if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
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

                try {
                    await enqueue(entry);
                } catch {
                    // Without a queue we cannot honestly claim the change was
                    // kept, so the failure goes back to the caller.
                    return Promise.reject(error);
                }

                // Show it on the screen that made it. Queuing silently is
                // indistinguishable, to the user, from being ignored.
                const optimistic = await applyWriteLocally(entry);

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
