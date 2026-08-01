/**
 * A figure that can be relied on, from a value that cannot.
 *
 * Screens used to call `.toFixed(2)` or `.toLocaleString()` straight on the
 * field, which is right until a record arrives without it — and one does: a
 * product created with no connection has no price, no cost and no stock
 * until the server works them out, because the form that made it never
 * asked. On a shop's very first product there is not even an earlier row to
 * copy the shape from, and `undefined.toFixed` took the whole catalogue
 * down with it.
 *
 * A missing figure counts as zero. For a record the server has not seen
 * yet that is the truth: nothing has been bought, sold or priced.
 */
export function amount(value: unknown): number {
    const parsed = typeof value === 'string' ? Number(value) : value;

    return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : 0;
}

/** The same figure printed to two decimals. */
export function money(value: unknown, decimals = 2): string {
    return amount(value).toFixed(decimals);
}

/** Grouped for reading — "12,560.00" — the way the money columns print it. */
export function grouped(value: unknown, decimals = 2): string {
    return amount(value).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}
