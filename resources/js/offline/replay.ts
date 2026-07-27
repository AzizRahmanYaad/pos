import axios from 'axios';
import { updateEntry, type OutboxEntry } from '@/offline/db';
import { IDEMPOTENCY_HEADER, rawClient } from '@/offline/rawClient';

export type ReplayOutcome = 'sent' | 'offline' | 'refused';

/**
 * Send one queued change to the server.
 *
 * The entry's own id travels as the idempotency key, so if this device
 * already got the change through and merely lost the reply, the server
 * hands back the original answer instead of doing it a second time.
 */
export async function replayQueuedRequest(entry: OutboxEntry): Promise<ReplayOutcome> {
    await updateEntry({ ...entry, state: 'sending', attempts: entry.attempts + 1 });

    try {
        await rawClient.request({
            method: entry.method,
            url: entry.url,
            data: entry.data,
            headers: { [IDEMPOTENCY_HEADER]: entry.id },
        });

        return 'sent';
    } catch (error) {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;

        // No response at all means the connection, not the request.
        if (status === undefined) {
            await updateEntry({ ...entry, state: 'pending', attempts: entry.attempts + 1 });

            return 'offline';
        }

        // 409 while a previous attempt is still in flight is worth another
        // go later; everything else is a decision the server has made.
        if (status === 409) {
            await updateEntry({ ...entry, state: 'pending', attempts: entry.attempts + 1 });

            return 'offline';
        }

        const message = axios.isAxiosError(error)
            ? ((error.response?.data as { message?: string } | undefined)?.message ?? error.message)
            : String(error);

        await updateEntry({
            ...entry,
            state: 'conflict',
            attempts: entry.attempts + 1,
            error: message,
            errorStatus: status,
        });

        return 'refused';
    }
}
