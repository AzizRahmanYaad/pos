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
    setUser: (user: AuthUser) => void;
    can: (permission: string) => boolean;
    canAny: (permissions: string[]) => boolean;
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

    /** Reflect a change the user just made to their own account. */
    setUser(user) {
        set({ user });
    },

    can(permission) {
        return get().user?.permissions.includes(permission) ?? false;
    },

    /** True when the user holds at least one of these — used to decide
     * whether a screen is reachable at all when several actions can open it. */
    canAny(permissions) {
        const held = get().user?.permissions;

        return held !== undefined && permissions.some((permission) => held.includes(permission));
    },
}));

window.addEventListener('pos:unauthorized', () => {
    useAuthStore.setState({ user: null, status: 'guest' });
});
