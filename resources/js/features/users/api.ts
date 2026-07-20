import { apiClient } from '@/lib/apiClient';

export interface UserListItem {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    locale: string;
    is_active: boolean;
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

export interface CreateUserPayload {
    name: string;
    email: string;
    phone?: string;
    password: string;
    password_confirmation: string;
    locale: string;
    is_active: boolean;
    roles: string[];
}

export async function createUser(payload: CreateUserPayload): Promise<UserListItem> {
    const { data } = await apiClient.post<{ data: UserListItem }>('/users', payload);
    return data.data;
}

export interface UpdateUserPayload {
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
    password_confirmation?: string;
    locale?: string;
    is_active?: boolean;
    roles?: string[];
}

export async function updateUser(userId: number, payload: UpdateUserPayload): Promise<UserListItem> {
    const { data } = await apiClient.put<{ data: UserListItem }>(`/users/${userId}`, payload);
    return data.data;
}

export async function deleteUser(userId: number): Promise<void> {
    await apiClient.delete(`/users/${userId}`);
}
