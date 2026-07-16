import axios from 'axios';
import i18n from '@/i18n/i18n';

export const apiClient = axios.create({
    baseURL: '/api/v1',
    withCredentials: true,
    withXSRFToken: true,
    headers: {
        Accept: 'application/json',
    },
});

apiClient.interceptors.request.use((config) => {
    config.headers['X-Locale'] = i18n.language?.split('-')[0] ?? 'en';
    return config;
});

export async function ensureCsrfCookie() {
    await axios.get('/sanctum/csrf-cookie', { baseURL: '/', withCredentials: true });
}

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
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
