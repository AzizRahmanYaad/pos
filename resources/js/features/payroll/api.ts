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
    employee_id: number | null;
    employee_name: string | null;
    period_month: number;
    period_year: number;
    period_date: string | null;
    status: 'draft' | 'paid';
    items: PayrollItemDto[];
    total_net_pay: number;
}

interface CollectionResponse<T> {
    data: T[];
}

export interface PayrollRunFilters {
    from?: string;
    to?: string;
    employeeId?: number;
}

export async function fetchPayrollRuns(filters: PayrollRunFilters = {}): Promise<PayrollRunDto[]> {
    const { data } = await apiClient.get<CollectionResponse<PayrollRunDto>>('/payroll-runs', {
        params: {
            ...(filters.from ? { from: filters.from } : {}),
            ...(filters.to ? { to: filters.to } : {}),
            ...(filters.employeeId ? { employee_id: filters.employeeId } : {}),
        },
    });
    return data.data;
}

export async function fetchPayrollRun(id: number): Promise<PayrollRunDto> {
    const { data } = await apiClient.get<{ data: PayrollRunDto }>(`/payroll-runs/${id}`);
    return data.data;
}

export async function downloadPayrollReportPdf(
    id: number,
): Promise<{ url: string; filename: string; blob: Blob }> {
    const response = await apiClient.get(`/payroll-runs/${id}/pdf`, { responseType: 'blob' });
    const disposition = String(response.headers['content-disposition'] ?? '');
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] ?? `payroll-${id}.pdf`;
    const blob = new Blob([response.data], { type: 'application/pdf' });
    return { url: URL.createObjectURL(blob), filename, blob };
}

export async function createPayrollRun(
    employeeId: number,
    date: string,
    bonuses = 0,
    otherDeductions = 0,
): Promise<PayrollRunDto> {
    const { data } = await apiClient.post('/payroll-runs', {
        employee_id: employeeId,
        date,
        bonuses,
        other_deductions: otherDeductions,
    });
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
