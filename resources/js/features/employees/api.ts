import { apiClient } from '@/lib/apiClient';

export interface EmployeeListItem {
    id: number;
    name: string;
    phone: string | null;
    designation: string | null;
    salary_amount: number;
    salary_type: 'monthly' | 'daily';
    is_active: boolean;
    current_balance: number;
    outstanding_advances: number;
}

interface CollectionResponse<T> {
    data: T[];
}

export async function fetchEmployees(search?: string): Promise<EmployeeListItem[]> {
    const { data } = await apiClient.get<CollectionResponse<EmployeeListItem>>('/employees', {
        params: search ? { search } : {},
    });
    return data.data;
}

export async function fetchEmployee(id: number): Promise<EmployeeListItem> {
    const { data } = await apiClient.get<{ data: EmployeeListItem }>(`/employees/${id}`);
    return data.data;
}

export interface EmployeeLedgerEntry {
    id: number;
    entry_type: 'debit' | 'credit';
    amount: number;
    running_balance: number;
    description: string | null;
    transaction_date: string;
}

export async function fetchEmployeeLedger(id: number): Promise<{ entries: EmployeeLedgerEntry[]; currentBalance: number }> {
    const { data } = await apiClient.get<{ data: EmployeeLedgerEntry[]; current_balance: number }>(
        `/employees/${id}/ledger`,
        { params: { per_page: 500 } },
    );
    return { entries: data.data, currentBalance: data.current_balance };
}

export async function downloadEmployeeStatementPdf(
    id: number,
): Promise<{ url: string; filename: string; blob: Blob }> {
    const response = await apiClient.get(`/employees/${id}/pdf`, { responseType: 'blob' });
    const disposition = String(response.headers['content-disposition'] ?? '');
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] ?? `employee-${id}.pdf`;
    const blob = new Blob([response.data], { type: 'application/pdf' });
    return { url: URL.createObjectURL(blob), filename, blob };
}

export interface CreateEmployeePayload {
    name: string;
    designation?: string;
    salary_amount: number;
    salary_type: 'monthly' | 'daily';
    hire_date?: string;
}

export async function createEmployee(payload: CreateEmployeePayload) {
    const { data } = await apiClient.post('/employees', payload);
    return data.data;
}

export async function recordEmployeeAdvance(
    employeeId: number,
    payload: { amount: number; cash_account_id: number; reason?: string },
) {
    await apiClient.post(`/employees/${employeeId}/advances`, payload);
}
