import { apiClient } from '@/lib/apiClient';

export type PartyKind = 'customer' | 'supplier';

function base(kind: PartyKind): string {
    return kind === 'customer' ? 'customers' : 'suppliers';
}

export interface PageMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

export interface LedgerEntry {
    id: number;
    entry_type: 'debit' | 'credit';
    amount: number;
    running_balance: number;
    description: string | null;
    source_type: string | null;
    transaction_date: string;
    archived_at: string | null;
    created_by: string | null;
}

export interface LedgerPage {
    data: LedgerEntry[];
    meta: PageMeta;
    current_balance: number;
}

export interface LedgerFilters {
    page: number;
    search?: string;
    from?: string;
    to?: string;
    includeArchived?: boolean;
}

export async function fetchPartyLedger(
    kind: PartyKind,
    partyId: number,
    filters: LedgerFilters,
): Promise<LedgerPage> {
    const { data } = await apiClient.get<LedgerPage>(`/${base(kind)}/${partyId}/ledger`, {
        params: {
            page: filters.page,
            per_page: 15,
            ...(filters.search ? { search: filters.search } : {}),
            ...(filters.from ? { from: filters.from } : {}),
            ...(filters.to ? { to: filters.to } : {}),
            ...(filters.includeArchived ? { include_archived: 1 } : {}),
        },
    });
    return data;
}

/** Archive a settled ledger — history moves to the system log. */
export async function clearPartyLedger(kind: PartyKind, partyId: number): Promise<void> {
    await apiClient.post(`/${base(kind)}/${partyId}/ledger/clear`);
}

/**
 * Download the ledger statement PDF (same filters as the on-screen view)
 * and return an object URL plus the suggested filename so the caller can
 * save it or hand it to the native share sheet for WhatsApp.
 */
export async function downloadPartyLedgerPdf(
    kind: PartyKind,
    partyId: number,
    filters: Omit<LedgerFilters, 'page'>,
): Promise<{ url: string; filename: string; blob: Blob }> {
    const response = await apiClient.get(`/${base(kind)}/${partyId}/ledger/pdf`, {
        responseType: 'blob',
        params: {
            ...(filters.search ? { search: filters.search } : {}),
            ...(filters.from ? { from: filters.from } : {}),
            ...(filters.to ? { to: filters.to } : {}),
            ...(filters.includeArchived ? { include_archived: 1 } : {}),
        },
    });

    const disposition = String(response.headers['content-disposition'] ?? '');
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] ?? `statement-${partyId}.pdf`;
    const blob = new Blob([response.data], { type: 'application/pdf' });

    return { url: URL.createObjectURL(blob), filename, blob };
}
