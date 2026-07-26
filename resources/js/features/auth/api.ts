import { apiClient, ensureCsrfCookie } from '@/lib/apiClient';

export interface AuthUser {
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

export interface ProfilePayload {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    locale?: string;
    logo?: File | null;
}

/** Update your own account details — no permission needed, it is yours. */
export async function updateProfile(payload: ProfilePayload): Promise<AuthUser> {
    const form = new FormData();
    form.append('name', payload.name);
    form.append('email', payload.email);
    if (payload.phone !== undefined) form.append('phone', payload.phone);
    if (payload.address !== undefined) form.append('address', payload.address);
    if (payload.locale) form.append('locale', payload.locale);
    if (payload.logo) form.append('logo', payload.logo);

    const { data } = await apiClient.post<UserResponse>('/auth/profile', form);
    return data.data;
}
