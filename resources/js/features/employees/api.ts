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

export async function fetchEmployees(): Promise<EmployeeListItem[]> {
    const { data } = await apiClient.get<CollectionResponse<EmployeeListItem>>('/employees');
    return data.data;
}

export interface CreateEmployeePayload {
    name: string;
    designation?: string;
    salary_amount: number;
    salary_type: 'monthly' | 'daily';
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
