import { apiClient } from '@/lib/apiClient';

export interface PayrollItemDto {
    id: number;
    employee_id: number;
    employee_name: string;
    base_salary: number;
    advances_deducted: number;
    other_deductions: number;
    bonuses: number;
    net_pay: number;
}

export interface PayrollRunDto {
    id: number;
    period_month: number;
    period_year: number;
    status: 'draft' | 'paid';
    items: PayrollItemDto[];
    total_net_pay: number;
}

interface CollectionResponse<T> {
    data: T[];
}

export async function fetchPayrollRuns(): Promise<PayrollRunDto[]> {
    const { data } = await apiClient.get<CollectionResponse<PayrollRunDto>>('/payroll-runs');
    return data.data;
}

export async function createPayrollRun(periodMonth: number, periodYear: number): Promise<PayrollRunDto> {
    const { data } = await apiClient.post('/payroll-runs', { period_month: periodMonth, period_year: periodYear });
    return data.data;
}

export async function payPayrollRun(id: number, cashAccountId: number): Promise<PayrollRunDto> {
    const { data } = await apiClient.post(`/payroll-runs/${id}/pay`, { cash_account_id: cashAccountId });
    return data.data;
}

export async function updatePayrollItem(id: number, bonuses: number, otherDeductions: number) {
    const { data } = await apiClient.put(`/payroll-items/${id}`, { bonuses, other_deductions: otherDeductions });
    return data.data;
}
