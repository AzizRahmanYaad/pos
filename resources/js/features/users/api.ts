import { apiClient } from '@/lib/apiClient';

export interface UserListItem {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    address: string | null;
    logo_url: string | null;
    locale: string;
    is_active: boolean;
    access_expires_at: string | null;
    roles: string[];
    created_at: string;
}

export interface RoleItem {
    name: string;
    permissions: string[];
}

interface CollectionResponse<T> {
    data: T[];
}

export async function fetchUsers(): Promise<UserListItem[]> {
    const { data } = await apiClient.get<CollectionResponse<UserListItem>>('/users');
    return data.data;
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
    payload.roles?.forEach((role) => form.append('roles[]', role));
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
