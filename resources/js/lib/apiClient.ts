import axios from 'axios';

export const apiClient = axios.create({
    baseURL: '/api/v1',
    withCredentials: true,
    withXSRFToken: true,
    headers: {
        Accept: 'application/json',
    },
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
