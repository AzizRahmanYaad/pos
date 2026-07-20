import { apiClient } from '@/lib/apiClient';

export interface OrganizationAdmin {
    id: number;
    name: string;
    email: string;
}

export interface Organization {
    id: number;
    name: string;
    slug: string;
    address: string | null;
    phone: string | null;
    logo_path: string | null;
    is_active: boolean;
    subscription_expires_at: string;
    created_at: string;
    admin_user?: OrganizationAdmin | null;
}

export interface SubscriptionStats {
    total_pos: number;
    active_pos: number;
    expired_subscriptions: number;
    expiring_soon: number;
    active_subscriptions: number;
}

export interface OrganizationListResponse {
    data: Organization[];
    pagination: {
        current_page: number;
        total: number;
        per_page: number;
    };
}

export interface CreateOrganizationPayload {
    name: string;
    address?: string;
    phone?: string;
    admin_name: string;
    admin_email: string;
    admin_password: string;
}

export interface AdminCredentials {
    email: string;
    password: string;
    note: string;
}

export interface CreateOrganizationResponse {
    message: string;
    organization: Organization;
    admin_credentials: AdminCredentials;
}

export async function listOrganizations(page = 1, search = ''): Promise<OrganizationListResponse> {
    const { data } = await apiClient.get<OrganizationListResponse>('/superadmin/organizations', {
        params: { page, per_page: 10, ...(search ? { search } : {}) },
    });
    return data;
}

export async function createOrganization(payload: CreateOrganizationPayload): Promise<CreateOrganizationResponse> {
    const { data } = await apiClient.post<CreateOrganizationResponse>('/superadmin/organizations', payload);
    return data;
}

export async function toggleOrganization(id: number): Promise<{ message: string; organization: Organization }> {
    const { data } = await apiClient.patch(`/superadmin/organizations/${id}/toggle`);
    return data;
}

export async function extendSubscription(id: number, years: number): Promise<{ message: string; organization: Organization }> {
    const { data } = await apiClient.post(`/superadmin/organizations/${id}/extend-subscription`, { years });
    return data;
}

export async function resetAdminPassword(id: number, newPassword: string): Promise<{ message: string }> {
    const { data } = await apiClient.post(`/superadmin/organizations/${id}/reset-password`, {
        new_password: newPassword,
    });
    return data;
}

export async function getSubscriptionStats(): Promise<SubscriptionStats> {
    const { data } = await apiClient.get<SubscriptionStats>('/superadmin/stats/subscriptions');
    return data;
}
