import { apiClient, ensureCsrfCookie } from '@/lib/apiClient';

export interface AuthUser {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    locale: string;
    is_active: boolean;
    roles: string[];
    permissions: string[];
    created_at: string;
}

interface UserResponse {
    data: AuthUser;
}

export async function login(email: string, password: string): Promise<AuthUser> {
    await ensureCsrfCookie();
    const { data } = await apiClient.post<UserResponse>('/auth/login', { email, password });
    return data.data;
}

export async function logout(): Promise<void> {
    await apiClient.post('/auth/logout');
}

export async function fetchCurrentUser(): Promise<AuthUser> {
    const { data } = await apiClient.get<UserResponse>('/auth/me');
    return data.data;
}
