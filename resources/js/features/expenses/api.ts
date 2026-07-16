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

export async function fetchExpenses(): Promise<ExpenseListItem[]> {
    const { data } = await apiClient.get<CollectionResponse<ExpenseListItem>>('/expenses');
    return data.data;
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
