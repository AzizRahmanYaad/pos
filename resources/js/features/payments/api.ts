import { apiClient } from '@/lib/apiClient';

export interface RecordPaymentPayload {
    party_type: 'customer' | 'supplier';
    party_id: number;
    direction: 'in' | 'out';
    amount: number;
    cash_account_id: number;
    method: 'cash' | 'card' | 'mobile_wallet' | 'bank';
    description?: string;
}

export async function recordPayment(payload: RecordPaymentPayload) {
    const { data } = await apiClient.post('/payments', payload);
    return data.data;
}
