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

export interface ProfitLoss {
    from: string;
    to: string;
    revenue: number;
    cogs: number;
    gross_profit: number;
    operating_expenses: number;
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
