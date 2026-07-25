import type { QueryClient } from '@tanstack/react-query';

/**
 * Every view that shows a cash-account balance or a cash-derived figure —
 * the header widget, the Dashboard's cash tile, the Cash Report, and the
 * Daily Journal — invalidated together whenever a mutation moves cash, so
 * no matter which one you're looking at, it never shows a stale number.
 */
export function invalidateCashViews(queryClient: QueryClient) {
    queryClient.invalidateQueries({ queryKey: ['cash-accounts'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    queryClient.invalidateQueries({ queryKey: ['report-cash-ledger'] });
    queryClient.invalidateQueries({ queryKey: ['daily-journal'] });
}
