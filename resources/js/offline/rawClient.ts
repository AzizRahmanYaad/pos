import axios from 'axios';
import i18n from '@/i18n/i18n';

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

/**
 * The same connection to the API as the application uses, without the
 * offline interceptors.
 *
 * Draining the queue must not go through the layer that fills it: a replay
 * that fails would otherwise be caught and queued again, and the same
 * change would multiply every time the connection wobbled.
 */
export const rawClient = axios.create({
    baseURL: '/api/v1',
    withCredentials: true,
    withXSRFToken: true,
    headers: { Accept: 'application/json' },
});

rawClient.interceptors.request.use((config) => {
    config.headers['X-Locale'] = i18n.language?.split('-')[0] ?? 'en';

    return config;
});
