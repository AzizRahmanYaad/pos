/**
 * A figure printed to two decimals, from a value that may not be one.
 *
 * Every screen used to call `.toFixed(2)` straight on the field, which is
 * right until a record arrives without it — and one does: a product created
 * with no connection has no price, no cost and no stock until the server
 * works them out, because the form that made it never asked. On a shop's
 * very first product there is not even an earlier row to copy the shape
 * from, and `undefined.toFixed` took the whole catalogue down with it.
 *
 * A missing figure is shown as 0.00. For a record the server has not seen
 * yet that is the truth: nothing has been bought, sold or priced.
 */
export function money(value: unknown, decimals = 2): string {
    const parsed = typeof value === 'string' ? Number(value) : value;
    const safe = typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : 0;

    return safe.toFixed(decimals);
}
