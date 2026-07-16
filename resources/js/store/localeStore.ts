import { create } from 'zustand';
import i18n, { isRtl, type SupportedLocale } from '@/i18n/i18n';
import { queryClient } from '@/lib/queryClient';

interface LocaleState {
    locale: SupportedLocale;
    direction: 'ltr' | 'rtl';
    setLocale: (locale: SupportedLocale) => void;
}

function applyDocumentDirection(locale: SupportedLocale) {
    const direction = isRtl(locale) ? 'rtl' : 'ltr';
    document.documentElement.dir = direction;
    document.documentElement.lang = locale;
    return direction;
}

const initialLocale = (i18n.language?.split('-')[0] as SupportedLocale) || 'en';

export const useLocaleStore = create<LocaleState>((set) => ({
    locale: initialLocale,
    direction: applyDocumentDirection(initialLocale),
    setLocale: (locale) => {
        i18n.changeLanguage(locale);
        const direction = applyDocumentDirection(locale);
        set({ locale, direction });
        queryClient.invalidateQueries();
    },
}));
