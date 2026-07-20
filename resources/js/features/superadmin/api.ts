import axios from 'axios';

const API = axios.create({
    baseURL: '/api/v1/superadmin',
    withCredentials: true,
});

export const superAdminAPI = {
    listOrganizations: (page = 1, search = '', active = null) => {
        let params = { page, per_page: 10 };
        if (search) params.search = search;
        if (active !== null) params.active = active;
        return API.get('/organizations', { params });
    },

    createOrganization: (data: {
        name: string;
        address?: string;
        phone?: string;
        admin_name: string;
        admin_email: string;
        admin_password: string;
        logo_path?: string;
    }) => API.post('/organizations', data),

    getOrganization: (id: number) => API.get(`/organizations/${id}`),

    updateOrganization: (id: number, data: any) =>
        API.put(`/organizations/${id}`, data),

    toggleOrganization: (id: number) =>
        API.patch(`/organizations/${id}/toggle`),

    extendSubscription: (id: number, years: number) =>
        API.post(`/organizations/${id}/extend-subscription`, { years }),

    resetAdminPassword: (id: number, newPassword: string) =>
        API.post(`/organizations/${id}/reset-password`, {
            new_password: newPassword,
        }),

    getSubscriptionStats: () => API.get('/stats/subscriptions'),
};

export default superAdminAPI;
