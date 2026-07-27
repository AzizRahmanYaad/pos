import axios from 'axios';
import {
    idAliases,
    rememberRealId,
    resolveAliases,
    temporaryId,
    updateEntry,
    type OutboxEntry,
} from '@/offline/db';
import { IDEMPOTENCY_HEADER, rawClient } from '@/offline/rawClient';

export type ReplayOutcome = 'sent' | 'offline' | 'refused';

/** Set by the server on the one refusal that is worth sending again. */
const PENDING_HEADER = 'idempotency-pending';

/** After this many tries, a change needs a person rather than another go. */
const MAX_ATTEMPTS = 10;

/** The id the server gave back, whatever shape the endpoint wraps it in. */
function createdId(body: unknown): number | null {
    if (body === null || typeof body !== 'object') return null;

    const record = ((body as { data?: unknown }).data ?? body) as { id?: unknown };

    return typeof record.id === 'number' ? record.id : null;
}

/**
 * "/customers/-90468" once the alias is known becomes "/customers/57".
 *
 * Whole path segments only, so a route that merely contains a dash — say
 * "/period-closing" — is left exactly as it is.
 */
function resolveUrl(url: string, aliases: Map<number, number>): string {
    const [path, query] = url.split('?');

    const resolved = path
        .split('/')
        .map((segment) => {
            if (!/^-\d+$/.test(segment)) return segment;

            const real = aliases.get(Number(segment));

            return real === undefined ? segment : String(real);
        })
        .join('/');

    return query === undefined ? resolved : `${resolved}?${query}`;
}

/**
 * Send one queued change to the server.
 *
 * The entry's own id travels as the idempotency key, so if this device
 * already got the change through and merely lost the reply, the server
 * hands back the original answer instead of doing it a second time.
 *
 * Anything the change refers to that was itself created on this device is
 * translated first: the queue drains oldest first, so by the time a sale
 * goes out, the customer it was made to already has a real id.
 */
export async function replayQueuedRequest(entry: OutboxEntry): Promise<ReplayOutcome> {
    await updateEntry({ ...entry, state: 'sending', attempts: entry.attempts + 1 });

    const aliases = await idAliases(entry.userId);

    try {
        const response = await rawClient.request({
            method: entry.method,
            url: resolveUrl(entry.url, aliases),
            data: resolveAliases(entry.data, aliases),
            headers: { [IDEMPOTENCY_HEADER]: entry.id },
        });

        // Whatever this device called the new record, this is its real name
        // — which anything queued behind it will need.
        const realId = createdId(response.data);

        if (entry.method === 'POST' && realId !== null) {
            await rememberRealId(temporaryId(entry.id), realId, entry.userId);
        }

        return 'sent';
    } catch (error) {
        const response = axios.isAxiosError(error) ? error.response : undefined;
        const status = response?.status;

        // No response at all means the connection, not the request.
        if (status === undefined) {
            await updateEntry({ ...entry, state: 'pending', attempts: entry.attempts + 1 });

            return 'offline';
        }

        // A 409 has two quite different meanings. "Already being processed"
        // clears itself and deserves another go; "insufficient stock" never
        // will. Retrying the second for ever would leave a refused sale
        // cycling silently instead of in front of the person who made it,
        // so only the marked one goes back in the queue — and even that
        // gives up eventually rather than never being seen.
        const retryable = status === 409
            && String(response?.headers?.[PENDING_HEADER] ?? '') !== ''
            && entry.attempts + 1 < MAX_ATTEMPTS;

        if (retryable) {
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
