import i18n from '@/i18n/i18n';
import { showToast } from '@/store/toastStore';

/**
 * Every Print/PDF/WhatsApp action across the app downloads a PDF the same
 * way, wrapped in its own try/finally that only resets a busy flag — a
 * failure (network error, server error) had nowhere to go: the button
 * just re-enabled with no toast, no message, nothing to tell the user
 * anything went wrong. This wraps the download call so a failure always
 * surfaces the same toast every other action in the app already gives.
 */
export async function downloadOrToast<T>(action: () => Promise<T>): Promise<T | undefined> {
    try {
        return await action();
    } catch {
        showToast(i18n.t('common.action_failed'), 'error');
        return undefined;
    }
}
