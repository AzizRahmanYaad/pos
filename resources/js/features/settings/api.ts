import { apiClient } from '@/lib/apiClient';

export interface BusinessSettings {
    company_name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    logo_path: string | null;
    currency_code: string;
    currency_symbol: string;
    default_locale: string;
    fiscal_year_start_month: number;
    invoice_prefix: string;
    purchase_prefix: string;
    receipt_footer: string | null;
    default_tax_rate: number;
    auto_close_daily: boolean;
}

export type UpdateBusinessSettingsPayload = Partial<BusinessSettings>;

export async function fetchBusinessSettings(): Promise<BusinessSettings> {
    const { data } = await apiClient.get<{ data: BusinessSettings }>('/settings');
    return data.data;
}

export async function updateBusinessSettings(payload: UpdateBusinessSettingsPayload): Promise<BusinessSettings> {
    const { data } = await apiClient.put<{ data: BusinessSettings }>('/settings', payload);
    return data.data;
}

export interface UpdatePasswordPayload {
    current_password: string;
    password: string;
    password_confirmation: string;
}

export async function updatePassword(payload: UpdatePasswordPayload): Promise<void> {
    await apiClient.put('/auth/password', payload);
}
