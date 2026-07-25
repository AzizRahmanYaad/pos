import { apiClient } from '@/lib/apiClient';

export interface UserListItem {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    address: string | null;
    tenant_id: number | null;
    tenant_name: string | null;
    logo_url: string | null;
    locale: string;
    is_active: boolean;
    access_expires_at: string | null;
    roles: string[];
    permissions: string[];
    direct_permissions: string[];
    created_at: string;
}

/** Where a business stands against its account allowance. */
export interface UserLimit {
    max_users: number | null;
    user_count: number;
    remaining: number | null;
    reached: boolean;
}

export interface TenantItem {
    id: number;
    name: string;
    max_users: number | null;
    user_count: number;
    remaining_user_slots: number | null;
}

export async function fetchTenants(): Promise<TenantItem[]> {
    const { data } = await apiClient.get<TenantItem[]>('/tenants');
    return data;
}

/** Set how many accounts a business may create; null lifts the ceiling. */
export async function updateTenantUserLimit(tenantId: number, maxUsers: number | null): Promise<TenantItem> {
    const { data } = await apiClient.put<TenantItem>(`/tenants/${tenantId}`, { max_users: maxUsers });
    return data;
}

export interface PermissionAction {
    action: string;
    permission: string;
}

export interface PermissionModule {
    key: string;
    group: string;
    actions: PermissionAction[];
}

export interface PermissionCatalogue {
    modules: PermissionModule[];
    presets: Record<string, string[]>;
    grantable: string[];
}

/** The module matrix, role presets, and the ceiling of what the signed-in
 * admin may hand out — served from the same manifest the API enforces. */
export async function fetchPermissionCatalogue(): Promise<PermissionCatalogue> {
    const { data } = await apiClient.get<PermissionCatalogue>('/permissions');
    return data;
}

export interface RoleItem {
    name: string;
    permissions: string[];
}

interface CollectionResponse<T> {
    data: T[];
}

export interface UsersPage {
    users: UserListItem[];
    limit: UserLimit | null;
}

export async function fetchUsers(): Promise<UsersPage> {
    const { data } = await apiClient.get<CollectionResponse<UserListItem> & { limit: UserLimit | null }>('/users');
    return { users: data.data, limit: data.limit ?? null };
}

export async function fetchRoles(): Promise<RoleItem[]> {
    const { data } = await apiClient.get<RoleItem[]>('/roles');
    return data;
}

export interface UserPayload {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    logo?: File | null;
    password?: string;
    password_confirmation?: string;
    locale: string;
    // Omit both when editing your own account — the backend rejects
    // changing your own roles or deactivating yourself.
    is_active?: boolean;
    roles?: string[];
    // Exactly what this account may do. Sent as the full ticked set, so
    // unticking a box always takes effect.
    permissions?: string[];
    // Which business a staff (manager/cashier) account belongs to. Only
    // the platform owner may set this; it is ignored for anyone else.
    tenant_id?: number;
    // Account allowance for a newly founded business.
    max_users?: number | null;
}

function toFormData(payload: UserPayload): FormData {
    const form = new FormData();
    form.append('name', payload.name);
    form.append('email', payload.email);
    if (payload.phone) form.append('phone', payload.phone);
    if (payload.address) form.append('address', payload.address);
    if (payload.logo) form.append('logo', payload.logo);
    if (payload.password) {
        form.append('password', payload.password);
        form.append('password_confirmation', payload.password_confirmation ?? '');
    }
    form.append('locale', payload.locale);
    if (payload.is_active !== undefined) form.append('is_active', payload.is_active ? '1' : '0');
    if (payload.tenant_id !== undefined) form.append('tenant_id', String(payload.tenant_id));
    if (payload.max_users !== undefined && payload.max_users !== null) {
        form.append('max_users', String(payload.max_users));
    }
    payload.roles?.forEach((role) => form.append('roles[]', role));
    // An empty marker keeps "no permissions at all" distinguishable from
    // "permissions were not part of this request" once PHP parses the body.
    if (payload.permissions !== undefined) {
        if (payload.permissions.length === 0) {
            form.append('permissions', '');
        } else {
            payload.permissions.forEach((permission) => form.append('permissions[]', permission));
        }
    }
    return form;
}

export async function createUser(payload: UserPayload): Promise<UserListItem> {
    const { data } = await apiClient.post<{ data: UserListItem }>('/users', toFormData(payload));
    return data.data;
}

export async function updateUser(userId: number, payload: UserPayload): Promise<UserListItem> {
    // Multipart bodies are only parsed on POST, so spoof the PUT method.
    const form = toFormData(payload);
    form.append('_method', 'PUT');
    const { data } = await apiClient.post<{ data: UserListItem }>(`/users/${userId}`, form);
    return data.data;
}

export async function extendUserAccess(userId: number): Promise<UserListItem> {
    const { data } = await apiClient.post<{ data: UserListItem }>(`/users/${userId}/extend`);
    return data.data;
}

export async function deleteUser(userId: number): Promise<void> {
    await apiClient.delete(`/users/${userId}`);
}
