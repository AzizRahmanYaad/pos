import { create } from 'zustand';
import { countUnsent, pendingEntries, removeEntry, updateEntry, type OutboxEntry } from '@/offline/db';

type Status = 'online' | 'offline' | 'syncing';

interface SyncState {
    status: Status;
    /** Changes made here that the server has not accepted yet. */
    unsent: number;
    /** Changes the server refused — these need a person, not another retry. */
    conflicts: OutboxEntry[];
    lastSyncedAt: number | null;
    setOnline: (online: boolean) => void;
    refresh: (userId: number) => Promise<void>;
    sync: (userId: number) => Promise<void>;
    dismissConflict: (id: string, userId: number) => Promise<void>;
}

/**
 * `navigator.onLine` only knows whether the device has *a* network, not
 * whether our server is reachable behind it — a shop's router can be up
 * with the line to the world down. So a failed request is what actually
 * marks us offline, and a successful one is what marks us back.
 */
export const useSyncStore = create<SyncState>((set, get) => ({
    status: navigator.onLine ? 'online' : 'offline',
    unsent: 0,
    conflicts: [],
    lastSyncedAt: null,

    setOnline(online) {
        const current = get().status;

        // Never overwrite 'syncing' with 'online' — the drain decides that.
        if (current === 'syncing' && online) return;

        set({ status: online ? 'online' : 'offline' });
    },

    async refresh(userId) {
        const entries = await pendingEntries(userId);

        set({
            unsent: entries.filter((entry) => entry.state !== 'conflict').length,
            conflicts: entries.filter((entry) => entry.state === 'conflict'),
        });
    },

    /**
     * Send what is waiting, oldest first, stopping the moment the network
     * goes again — the remaining entries keep their place in the queue.
     */
    async sync(userId) {
        if (get().status === 'syncing') return;

        const entries = (await pendingEntries(userId)).filter((entry) => entry.state !== 'conflict');

        if (entries.length === 0) {
            set({ status: 'online' });
            await get().refresh(userId);

            return;
        }

        set({ status: 'syncing' });

        // Imported here rather than at the top: the api client imports this
        // store, and a cycle between them leaves one of the two undefined.
        const { replayQueuedRequest } = await import('@/offline/replay');

        for (const entry of entries) {
            const outcome = await replayQueuedRequest(entry);

            if (outcome === 'sent') {
                await removeEntry(entry.id);
                await get().refresh(userId);

                continue;
            }

            if (outcome === 'offline') {
                // Still no connection. Leave the rest queued, in order.
                set({ status: 'offline' });
                await get().refresh(userId);

                return;
            }

            if (outcome === 'later') {
                // The server is up and has asked us to slow down — a till
                // draining a long outage will trip its rate limit part way
                // through. Stop the pass rather than hammering; the timer
                // picks the rest up shortly, in the same order.
                set({ status: 'online' });
                await get().refresh(userId);

                return;
            }

            // Refused. Retrying will not change the answer, so it stops here
            // and waits for somebody to look at it.
            await get().refresh(userId);
        }

        set({ status: 'online', lastSyncedAt: Date.now() });
        await get().refresh(userId);

        // The device has been showing its own optimistic copies; replace them
        // with what the server actually recorded, temporary ids and all.
        const { warmOfflineCache } = await import('@/offline/prefetch');
        void warmOfflineCache(userId);
    },

    async dismissConflict(id, userId) {
        await removeEntry(id);
        await get().refresh(userId);
    },
}));

/** Called by the api client so the indicator reflects reality, not guesses. */
export function reportReachable(reachable: boolean): void {
    useSyncStore.getState().setOnline(reachable);
}

export async function refreshUnsentCount(userId: number): Promise<void> {
    const unsent = await countUnsent(userId);

    useSyncStore.setState({ unsent });
}

export { updateEntry };
