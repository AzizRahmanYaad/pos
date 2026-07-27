import axios from 'axios';
import i18n from '@/i18n/i18n';
import { useRequestLoadingStore } from '@/lib/loadingStore';
import { installOfflineInterceptors } from '@/offline/interceptors';

export const apiClient = axios.create({
    baseURL: '/api/v1',
    withCredentials: true,
    withXSRFToken: true,
    // A shop's connection does not always fail cleanly. A router that is up
    // with no route beyond it leaves requests hanging until TCP gives up
    // minutes later, and a till frozen mid-sale is worse than one that knows
    // it is offline. After this, the request is treated as unreachable and
    // the change is queued.
    timeout: 20_000,
    headers: {
        Accept: 'application/json',
    },
});

apiClient.interceptors.request.use((config) => {
    config.headers['X-Locale'] = i18n.language?.split('-')[0] ?? 'en';
    useRequestLoadingStore.getState().start();
    return config;
});

export async function ensureCsrfCookie() {
    useRequestLoadingStore.getState().start();
    try {
        await axios.get('/sanctum/csrf-cookie', { baseURL: '/', withCredentials: true });
    } finally {
        useRequestLoadingStore.getState().finish();
    }
}

apiClient.interceptors.response.use(
    (response) => {
        useRequestLoadingStore.getState().finish();
        return response;
    },
    (error) => {
        useRequestLoadingStore.getState().finish();
        if (error.response?.status === 401) {
            window.dispatchEvent(new CustomEvent('pos:unauthorized'));
        }
        if (error.response?.status === 423) {
            window.dispatchEvent(
                new CustomEvent('pos:period-closed', { detail: error.response.data }),
            );
        }
        return Promise.reject(error);
    },
);

// Registered last so it runs after the handler above: that one turns 401s
// and closed periods into app events, this one decides whether a failure
// was the network — in which case the read is served from the device and
// the write is queued rather than lost.
installOfflineInterceptors(apiClient);
