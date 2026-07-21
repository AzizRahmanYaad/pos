import { apiClient } from '@/lib/apiClient';

export interface ExpenseCategoryItem {
    id: number;
    name: string;
    is_landed_cost_type: boolean;
}

export interface ExpenseListItem {
    id: number;
    category_name: string;
    cash_account_name: string;
    amount: number;
    expense_date: string;
    description: string | null;
    is_landed_cost: boolean;
    purchase_number: string | null;
}

interface CollectionResponse<T> {
    data: T[];
}

export async function fetchExpenseCategories(): Promise<ExpenseCategoryItem[]> {
    const { data } = await apiClient.get<CollectionResponse<ExpenseCategoryItem>>('/expense-categories');
    return data.data;
}

export async function createExpenseCategory(name: string): Promise<ExpenseCategoryItem> {
    const { data } = await apiClient.post('/expense-categories', { name });
    return data.data;
}

export interface ExpenseRange {
    from?: string;
    to?: string;
}

export async function fetchExpenses(range: ExpenseRange = {}): Promise<ExpenseListItem[]> {
    const { data } = await apiClient.get<CollectionResponse<ExpenseListItem>>('/expenses', {
        params: {
            per_page: 500,
            ...(range.from ? { from: range.from } : {}),
            ...(range.to ? { to: range.to } : {}),
        },
    });
    return data.data;
}

export interface ExpenseCategoryTotal {
    category_name: string;
    count: number;
    total: number;
}

export interface ExpenseSummary {
    from: string | null;
    to: string | null;
    count: number;
    grand_total: number;
    categories: ExpenseCategoryTotal[];
}

export async function fetchExpenseSummary(range: ExpenseRange = {}): Promise<ExpenseSummary> {
    const { data } = await apiClient.get<{ data: ExpenseSummary }>('/expenses/summary', {
        params: {
            ...(range.from ? { from: range.from } : {}),
            ...(range.to ? { to: range.to } : {}),
        },
    });
    return data.data;
}

export async function downloadExpenseReportPdf(
    range: ExpenseRange = {},
): Promise<{ url: string; filename: string; blob: Blob }> {
    const response = await apiClient.get('/expenses/report/pdf', {
        params: {
            ...(range.from ? { from: range.from } : {}),
            ...(range.to ? { to: range.to } : {}),
        },
        responseType: 'blob',
    });
    const disposition = String(response.headers['content-disposition'] ?? '');
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] ?? `expenses-${new Date().toISOString().slice(0, 10)}.pdf`;
    const blob = new Blob([response.data], { type: 'application/pdf' });
    return { url: URL.createObjectURL(blob), filename, blob };
}

export interface CreateExpensePayload {
    expense_category_id: number;
    cash_account_id: number;
    amount: number;
    description?: string;
    is_landed_cost?: boolean;
    purchase_id?: number;
}

export async function createExpense(payload: CreateExpensePayload) {
    const { data } = await apiClient.post('/expenses', payload);
    return data.data;
}
