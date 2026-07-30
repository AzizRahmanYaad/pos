import { rawClient } from '@/offline/rawClient';
import { allCaches, countUnsent, writeCache } from '@/offline/db';
import { localDate } from '@/offline/journal';

/** One answer worth having on the device before the line goes down. */
interface WarmEntry {
    url: string;
    params?: Record<string, unknown>;
}

/**
 * Everything a shop needs on the device before the line goes down.
 *
 * The cache only ever held screens somebody had already opened, which meant
 * "works offline" really meant "works offline on the pages you happened to
 * visit first". A till that has never opened Suppliers should still be able
 * to open it during an outage.
 *
 * Written through the raw client so a failure here is silent and local:
 * warming a cache is not something to interrupt anyone about.
 */
const WARM: WarmEntry[] = [
    { url: '/settings' },
    { url: '/products', params: { per_page: 500 } },
    { url: '/products' },
    { url: '/customers', params: { per_page: 500 } },
    { url: '/customers' },
    { url: '/suppliers', params: { per_page: 500 } },
    { url: '/suppliers' },
    { url: '/categories' },
    { url: '/units' },
    { url: '/warehouses' },
    { url: '/cash-accounts' },
    { url: '/expense-categories' },
    { url: '/employees' },
    // Asked for in full, not a page at a time: what the device holds during
    // an outage should be the whole list, and the stock summary is recounted
    // from this copy rather than from whatever page was last opened.
    { url: '/expenses', params: { per_page: 500 } },
    { url: '/sales' },
    { url: '/purchases' },
    { url: '/payroll-runs' },
    { url: '/period-closings' },
    { url: '/inventory/stock', params: { per_page: 500 } },
    { url: '/inventory/stock/summary' },
    { url: '/inventory/stock/alerts' },
    { url: '/stock-movements' },
    { url: '/dashboard/summary' },
    { url: '/roles' },
    { url: '/permissions' },
    { url: '/users' },
    { url: '/activity-log' },
    { url: '/customers/summary' },
];

/**
 * What the platform account gets instead: its own screens, and nothing of
 * any shop's. It administers businesses and their accounts, so a till's
 * worth of products, stock and takings is neither useful to it nor its to
 * hold — and the server refuses it all of them anyway, which would make
 * warming thirty-odd requests spent collecting refusals.
 */
const ADMIN_WARM: WarmEntry[] = [
    { url: '/tenants' },
    { url: '/roles' },
    { url: '/permissions' },
    { url: '/users' },
    { url: '/activity-log' },
];

/**
 * The recent sales, each fetched in full.
 *
 * A list row is not a record: opening one asks for /sales/{id}, and taking
 * a return needs the lines and quantities that only the full sale carries.
 * Without this a cashier could see that a sale happened during an outage
 * but not what was in it, and could not refund it — which is exactly when
 * a customer is standing there wanting to give something back.
 */
const RECENT_SALES = 15;

/**
 * Only the ones this device does not already hold.
 *
 * A sale never changes after it is rung up, apart from a return — and a
 * return comes back through the queue, which patches the cached copy
 * itself. Re-fetching all of them on every warm pass would spend most of
 * the account's rate limit on answers the device already has, and that
 * limit is shared with the queue trying to drain.
 */
async function warmRecentSales(userId: number): Promise<void> {
    try {
        const list = await rawClient.get('/sales', { params: { per_page: RECENT_SALES } });
        const rows = Array.isArray(list.data?.data) ? list.data.data : [];
        const held = new Set((await allCaches(userId)).map((entry) => entry.key));

        for (const row of rows.slice(0, RECENT_SALES)) {
            if (typeof row?.id !== 'number') continue;
            if (held.has(`GET /api/v1/sales/${row.id}`)) continue;

            try {
                const detail = await rawClient.get(`/sales/${row.id}`);

                await writeCache({
                    key: `GET /api/v1/sales/${row.id}`,
                    userId,
                    status: detail.status,
                    body: detail.data,
                    fetchedAt: Date.now(),
                });
            } catch {
                // One sale that will not load is not worth abandoning the rest.
            }
        }
    } catch {
        // No list, nothing to walk.
    }
}

/**
 * The recent purchases, each fetched in full.
 *
 * Same reason as the sales above, for the other side of the counter: a list
 * row is not a purchase, and receiving a delivery needs the lines and costs
 * that only the full record carries. Without this a shopkeeper could see
 * that a delivery was expected but not open it, and so could not book it in
 * — which is exactly what happens when a lorry arrives during an outage.
 *
 * Drafts first: a received purchase is finished business, a draft is the one
 * somebody still has to act on.
 */
const RECENT_PURCHASES = 15;

async function warmRecentPurchases(userId: number): Promise<void> {
    try {
        const list = await rawClient.get('/purchases', { params: { per_page: 60 } });
        const rows = Array.isArray(list.data?.data) ? list.data.data : [];
        const held = new Set((await allCaches(userId)).map((entry) => entry.key));

        const wanted = [
            ...rows.filter((row: Record<string, unknown>) => row.status === 'draft'),
            ...rows.filter((row: Record<string, unknown>) => row.status !== 'draft'),
        ].slice(0, RECENT_PURCHASES);

        for (const row of wanted) {
            if (typeof row?.id !== 'number') continue;
            if (held.has(`GET /api/v1/purchases/${row.id}`)) continue;

            try {
                const detail = await rawClient.get(`/purchases/${row.id}`);

                await writeCache({
                    key: `GET /api/v1/purchases/${row.id}`,
                    userId,
                    status: detail.status,
                    body: detail.data,
                    fetchedAt: Date.now(),
                });
            } catch {
                // One purchase that will not load is not worth abandoning
                // the rest.
            }
        }
    } catch {
        // No list, nothing to walk.
    }
}

/**
 * The statements of everyone who owes money, or is owed it.
 *
 * A settled account is not the one anybody opens during an outage. The
 * argument that needs a statement in front of it is always with someone
 * carrying a balance, so those are the ledgers worth the requests — and
 * there are rarely many.
 */
const OPEN_LEDGERS = 20;

async function warmOpenLedgers(userId: number): Promise<void> {
    for (const resource of ['/customers', '/suppliers'] as const) {
        try {
            const list = await rawClient.get(resource, { params: { per_page: 500 } });
            const rows = Array.isArray(list.data?.data) ? list.data.data : [];
            const owing = rows
                .filter((row: Record<string, unknown>) => Math.abs(Number(row.current_balance) || 0) > 0.0001)
                .slice(0, OPEN_LEDGERS);

            for (const row of owing) {
                if (typeof row?.id !== 'number') continue;

                const params = { page: 1, per_page: 25 };

                try {
                    const ledger = await rawClient.get(`${resource}/${row.id}/ledger`, { params });

                    await writeCache({
                        key: `GET /api/v1${resource}/${row.id}/ledger${JSON.stringify(params)}`,
                        userId,
                        status: ledger.status,
                        body: ledger.data,
                        fetchedAt: Date.now(),
                    });
                } catch {
                    // One statement short is not worth abandoning the rest.
                }
            }
        } catch {
            // No list, nothing to walk.
        }
    }
}

/**
 * The journal is asked for by date, so there is no one answer to keep — and
 * a day is exactly what a shop wants to see during an outage. Today gives
 * the queue something to be added to; the days either side cover a till
 * still open past midnight and the usual "what did we take yesterday?".
 */
function datedWarm(): WarmEntry[] {
    const days = [-1, 0, 1].map((offset) => {
        const day = new Date();
        day.setDate(day.getDate() + offset);

        return localDate(day.getTime());
    });

    return days.map((date) => ({ url: '/reports/daily-journal', params: { date } }));
}

let running = false;

/**
 * Fetch one answer onto the device, returning its body so the caller can
 * read it. A screen this user may not open, or a moment of bad line, is
 * nothing to stop for.
 */
async function warmOne(userId: number, { url, params }: WarmEntry): Promise<unknown> {
    try {
        const response = await rawClient.get(url, { params });

        await writeCache({
            // Must match how the api client builds its key, or the warmed
            // copy is never the one looked up.
            key: `GET /api/v1${url}${params ? JSON.stringify(params) : ''}`,
            userId,
            status: response.status,
            body: response.data,
            fetchedAt: Date.now(),
        });

        return response.data;
    } catch {
        return null;
    }
}

export async function warmOfflineCache(userId: number): Promise<void> {
    if (running || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;

    // Never while the till still has takings to send. Warming is thirty-odd
    // requests against a rate limit the queue has to share, and a device
    // reconnecting after an outage would spend it refreshing screens instead
    // of getting the day's sales to the server. The sync calls this itself
    // once the queue is empty, which is the right moment for it.
    if (await countUnsent(userId) > 0) return;

    running = true;

    try {
        // Who this is decides what is worth keeping, so it goes first — and
        // it is the one answer every account needs on the device anyway.
        const me = await warmOne(userId, { url: '/auth/me' });
        const permissions = (me as { data?: { permissions?: string[] } } | null)?.data?.permissions ?? [];
        const platformOwner = permissions.includes('companies.view');

        for (const entry of platformOwner ? ADMIN_WARM : [...WARM, ...datedWarm()]) {
            await warmOne(userId, entry);
        }

        // The rest is a shop's own trading, which the platform account has
        // no part in and no access to.
        if (platformOwner) return;

        await warmRecentSales(userId);
        await warmRecentPurchases(userId);
        await warmOpenLedgers(userId);
    } finally {
        running = false;
    }
}
