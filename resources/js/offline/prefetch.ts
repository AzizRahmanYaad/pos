import { rawClient } from '@/offline/rawClient';
import { writeCache } from '@/offline/db';
import { localDate } from '@/offline/journal';

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
const WARM: Array<{ url: string; params?: Record<string, unknown> }> = [
    { url: '/auth/me' },
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
    { url: '/expenses' },
    { url: '/sales' },
    { url: '/purchases' },
    { url: '/payroll-runs' },
    { url: '/period-closings' },
    { url: '/inventory/stock' },
    { url: '/inventory/stock/summary' },
    { url: '/inventory/stock/alerts' },
    { url: '/stock-movements' },
    { url: '/dashboard/summary' },
    { url: '/roles' },
    { url: '/permissions' },
    { url: '/users' },
    { url: '/activity-log' },
];

/**
 * The journal is asked for by date, so there is no one answer to keep — and
 * a day is exactly what a shop wants to see during an outage. Today gives
 * the queue something to be added to; the days either side cover a till
 * still open past midnight and the usual "what did we take yesterday?".
 */
function datedWarm(): Array<{ url: string; params?: Record<string, unknown> }> {
    const days = [-1, 0, 1].map((offset) => {
        const day = new Date();
        day.setDate(day.getDate() + offset);

        return localDate(day.getTime());
    });

    return days.map((date) => ({ url: '/reports/daily-journal', params: { date } }));
}

let running = false;

export async function warmOfflineCache(userId: number): Promise<void> {
    if (running || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;

    running = true;

    try {
        for (const { url, params } of [...WARM, ...datedWarm()]) {
            try {
                const response = await rawClient.get(url, { params });

                await writeCache({
                    // Must match how the api client builds its key, or the
                    // warmed copy is never the one looked up.
                    key: `GET /api/v1${url}${params ? JSON.stringify(params) : ''}`,
                    userId,
                    status: response.status,
                    body: response.data,
                    fetchedAt: Date.now(),
                });
            } catch {
                // A screen this user may not open, or a moment of bad line.
            }
        }
    } finally {
        running = false;
    }
}
