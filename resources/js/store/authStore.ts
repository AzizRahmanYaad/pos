import { create } from 'zustand';
import { isAxiosError } from 'axios';
import { fetchCurrentUser, login as loginRequest, logout as logoutRequest } from '@/features/auth/api';
import type { AuthUser } from '@/features/auth/api';
import { setOfflineUser } from '@/offline/interceptors';
import { useSyncStore } from '@/offline/syncStore';
import { warmOfflineCache } from '@/offline/prefetch';
import { rememberCredential, signInOffline } from '@/offline/credentials';

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
            // Remember this sign-in so the same person can get back in during
            // an outage. The password itself is never stored.
            void rememberCredential(email, password, user);
            set({ user, status: 'authenticated', error: null });
            void useSyncStore.getState().refresh(user.id);
            // Put the shop on the device now, while there is a line to do it.
            void warmOfflineCache(user.id);
        } catch (error) {
            // A wrong password and an unreachable server are different
            // problems and must not be reported as the same one.
            const unreachable = isAxiosError(error) && error.response === undefined;

            if (unreachable) {
                const offlineUser = await signInOffline(email, password);

                if (offlineUser) {
                    setOfflineUser(offlineUser.id);
                    set({ user: offlineUser, status: 'authenticated', error: null });
                    void useSyncStore.getState().refresh(offlineUser.id);

                    return;
                }

                set({ status: 'guest', error: 'offline_sign_in_failed' });
                throw error;
            }

            set({ status: 'guest', error: 'Invalid email or password' });
            throw error;
        }
    },

    async logout() {
        const previous = get().user;

        try {
            await logoutRequest();
        } finally {
            // The cache is kept, not cleared. Every entry records whose it
            // is and is only ever served back to that same account, so there
            // is nothing here for the next person on a shared till to see —
            // and throwing it away meant signing back in during an outage
            // gave you an application with no data in it. Anything queued is
            // kept for the same reason: it is their work, and it still has to
            // reach the server.
            void previous;
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
            void warmOfflineCache(user.id);
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
