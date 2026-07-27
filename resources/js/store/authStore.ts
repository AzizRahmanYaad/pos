import { create } from 'zustand';
import { fetchCurrentUser, login as loginRequest, logout as logoutRequest } from '@/features/auth/api';
import type { AuthUser } from '@/features/auth/api';
import { clearCacheFor } from '@/offline/db';
import { setOfflineUser } from '@/offline/interceptors';
import { useSyncStore } from '@/offline/syncStore';

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
            setOfflineUser(user.id);
            set({ user, status: 'authenticated', error: null });
            void useSyncStore.getState().refresh(user.id);
        } catch (error) {
            set({ status: 'guest', error: 'Invalid email or password' });
            throw error;
        }
    },

    async logout() {
        const previous = get().user;

        try {
            await logoutRequest();
        } finally {
            // Whatever was cached belonged to them, not to whoever signs in
            // next on this shared till. Anything still queued is deliberately
            // kept: it is their work, and it still has to reach the server.
            if (previous) await clearCacheFor(previous.id);
            setOfflineUser(null);
            set({ user: null, status: 'guest' });
        }
    },

    async bootstrap() {
        set({ status: 'loading' });
        try {
            const user = await fetchCurrentUser();
            setOfflineUser(user.id);
            set({ user, status: 'authenticated' });
            void useSyncStore.getState().refresh(user.id);
            void useSyncStore.getState().sync(user.id);
        } catch {
            set({ user: null, status: 'guest' });
        }
    },

    /** Reflect a change the user just made to their own account. */
    setUser(user) {
        setOfflineUser(user.id);
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
