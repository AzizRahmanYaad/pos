import { create } from 'zustand';
import { fetchCurrentUser, login as loginRequest, logout as logoutRequest } from '@/features/auth/api';
import type { AuthUser } from '@/features/auth/api';

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'guest';

interface AuthState {
    user: AuthUser | null;
    status: AuthStatus;
    error: string | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    bootstrap: () => Promise<void>;
    can: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    status: 'idle',
    error: null,

    async login(email, password) {
        set({ status: 'loading', error: null });
        try {
            const user = await loginRequest(email, password);
            set({ user, status: 'authenticated', error: null });
        } catch (error) {
            set({ status: 'guest', error: 'Invalid email or password' });
            throw error;
        }
    },

    async logout() {
        try {
            await logoutRequest();
        } finally {
            set({ user: null, status: 'guest' });
        }
    },

    async bootstrap() {
        set({ status: 'loading' });
        try {
            const user = await fetchCurrentUser();
            set({ user, status: 'authenticated' });
        } catch {
            set({ user: null, status: 'guest' });
        }
    },

    can(permission) {
        return get().user?.permissions.includes(permission) ?? false;
    },
}));

window.addEventListener('pos:unauthorized', () => {
    useAuthStore.setState({ user: null, status: 'guest' });
});
