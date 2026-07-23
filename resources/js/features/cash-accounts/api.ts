import { apiClient } from '@/lib/apiClient';
import type { LedgerEntry, LedgerFilters, LedgerPage, PageMeta } from '@/features/parties/ledgerApi';

export interface CashAccountListItem {
    id: number;
    name: string;
    type: string;
    is_active: boolean;
    current_balance: number;
}

interface CollectionResponse<T> {
    data: T[];
}

export async function fetchCashAccounts(): Promise<CashAccountListItem[]> {
    const { data } = await apiClient.get<CollectionResponse<CashAccountListItem>>('/cash-accounts');
    return data.data;
}

export async function fetchCashAccountLedger(
    cashAccountId: number,
    filters: Omit<LedgerFilters, 'includeArchived'>,
): Promise<LedgerPage> {
    const { data } = await apiClient.get<LedgerPage>(`/cash-accounts/${cashAccountId}/ledger`, {
        params: {
            page: filters.page,
            per_page: filters.perPage ?? 25,
            ...(filters.search ? { search: filters.search } : {}),
            ...(filters.from ? { from: filters.from } : {}),
            ...(filters.to ? { to: filters.to } : {}),
        },
    });
    return data;
}

export async function downloadCashAccountLedgerPdf(
    cashAccountId: number,
    filters: Omit<LedgerFilters, 'page' | 'includeArchived'>,
): Promise<{ url: string; filename: string; blob: Blob }> {
    const response = await apiClient.get(`/cash-accounts/${cashAccountId}/ledger/pdf`, {
        responseType: 'blob',
        params: {
            ...(filters.search ? { search: filters.search } : {}),
            ...(filters.from ? { from: filters.from } : {}),
            ...(filters.to ? { to: filters.to } : {}),
        },
    });

    const disposition = String(response.headers['content-disposition'] ?? '');
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] ?? `cash-statement-${cashAccountId}.pdf`;
    const blob = new Blob([response.data], { type: 'application/pdf' });

    return { url: URL.createObjectURL(blob), filename, blob };
}

export type { LedgerEntry, LedgerPage, PageMeta };
