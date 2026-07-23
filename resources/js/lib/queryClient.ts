import { MutationCache, QueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import i18n from '@/i18n/i18n';
import { showToast } from '@/store/toastStore';

function extractErrorMessage(error: unknown): string {
    if (isAxiosError(error)) {
        const message = (error.response?.data as { message?: string } | undefined)?.message;
        if (message) return message;
    }
    return i18n.t('common.action_failed');
}

/**
 * A mutation opts into toasts by passing `meta: { successMessage, errorMessage }`
 * — this fires automatically for every mutation in the app, so no call site
 * has to remember to show one. A mutation with no `errorMessage` still gets a
 * toast (parsed from the API response, or a generic fallback) so failures are
 * never silent; one with no `successMessage` simply stays quiet on success
 * (e.g. POS checkout already shows its own receipt screen).
 */
export const queryClient = new QueryClient({
    mutationCache: new MutationCache({
        onSuccess: (_data, _variables, _context, mutation) => {
            const message = mutation.meta?.successMessage;
            if (message) showToast(message, 'success');
        },
        onError: (error, _variables, _context, mutation) => {
            const message = mutation.meta?.errorMessage || extractErrorMessage(error);
            showToast(message, 'error');
        },
    }),
});
