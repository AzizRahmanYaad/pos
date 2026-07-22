import { apiClient } from '@/lib/apiClient';

export interface DashboardSummary {
    today_sales: number;
    today_sales_count: number;
    today_profit: number;
    low_stock_count: number;
    top_products: { product_id: number; name: string; quantity_sold: number; revenue: number }[];
    cash_position: number;
    receivables: number;
    payables: number;
    recent_sales: {
        id: number;
        invoice_number: string;
        customer_name: string;
        grand_total: number;
        sale_date: string;
    }[];
}

export interface ProfitLossExpenseCategory {
    category: string;
    total: number;
}

export interface ProfitLoss {
    from: string;
    to: string;
    revenue: number;
    cogs: number;
    gross_profit: number;
    operating_expenses: number;
    operating_expenses_by_category: ProfitLossExpenseCategory[];
    payroll_cost: number;
    net_profit: number;
}

export interface InventoryValuationRow {
    product_id: number;
    product_name: string;
    sku: string;
    warehouse_id: number;
    warehouse_name: string;
    quantity: number;
    average_cost: number;
    value: number;
}

export interface InventoryValuation {
    rows: InventoryValuationRow[];
    total_value: number;
}

export interface SalesSummaryRow {
    period: string;
    sale_count: number;
    total: number;
}

export interface ExpenseCategoryRow {
    category: string;
    total: number;
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
    const { data } = await apiClient.get<DashboardSummary>('/dashboard/summary');
    return data;
}

export async function fetchProfitLoss(from: string, to: string): Promise<ProfitLoss> {
    const { data } = await apiClient.get<ProfitLoss>('/reports/profit-loss', { params: { from, to } });
    return data;
}

export async function fetchInventoryValuation(): Promise<InventoryValuation> {
    const { data } = await apiClient.get<InventoryValuation>('/reports/inventory-valuation');
    return data;
}

export async function fetchSalesSummary(from: string, to: string, groupBy: 'day' | 'month' = 'day'): Promise<SalesSummaryRow[]> {
    const { data } = await apiClient.get<{ rows: SalesSummaryRow[] }>('/reports/sales-summary', {
        params: { from, to, group_by: groupBy },
    });
    return data.rows;
}

export async function fetchExpensesByCategory(from: string, to: string): Promise<ExpenseCategoryRow[]> {
    const { data } = await apiClient.get<{ rows: ExpenseCategoryRow[] }>('/reports/expenses-by-category', {
        params: { from, to },
    });
    return data.rows;
}

export interface PartyBalanceRow {
    id: number;
    name: string;
    phone: string | null;
    balance: number;
}

export interface PartyBalanceReport {
    rows: PartyBalanceRow[];
    total: number;
}

export async function fetchReceivables(): Promise<PartyBalanceReport> {
    const { data } = await apiClient.get<PartyBalanceReport>('/reports/receivables');
    return data;
}

export async function fetchPayables(): Promise<PartyBalanceReport> {
    const { data } = await apiClient.get<PartyBalanceReport>('/reports/payables');
    return data;
}

async function downloadReportPdf(
    path: string,
    params: Record<string, string | undefined> = {},
): Promise<{ url: string; filename: string; blob: Blob }> {
    const response = await apiClient.get(path, {
        params,
        responseType: 'blob',
    });
    const disposition = String(response.headers['content-disposition'] ?? '');
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] ?? 'report.pdf';
    const blob = new Blob([response.data], { type: 'application/pdf' });
    return { url: URL.createObjectURL(blob), filename, blob };
}

export const downloadProfitLossPdf = (from: string, to: string) =>
    downloadReportPdf('/reports/profit-loss/pdf', { from, to });

export const downloadInventoryValuationPdf = () => downloadReportPdf('/reports/inventory-valuation/pdf');

export const downloadSalesSummaryPdf = (from: string, to: string) =>
    downloadReportPdf('/reports/sales-summary/pdf', { from, to });

export const downloadExpensesByCategoryPdf = (from: string, to: string) =>
    downloadReportPdf('/reports/expenses-by-category/pdf', { from, to });

export const downloadReceivablesPdf = () => downloadReportPdf('/reports/receivables/pdf');

export const downloadPayablesPdf = () => downloadReportPdf('/reports/payables/pdf');
