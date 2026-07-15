import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en/common.json';
import ps from './locales/ps/common.json';
import prs from './locales/prs/common.json';

export const SUPPORTED_LOCALES = ['en', 'ps', 'prs'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const RTL_LOCALES: SupportedLocale[] = ['ps', 'prs'];

export function isRtl(locale: string): boolean {
    return RTL_LOCALES.includes(locale as SupportedLocale);
}

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: { common: en },
            ps: { common: ps },
            prs: { common: prs },
        },
        fallbackLng: 'en',
        supportedLngs: SUPPORTED_LOCALES as unknown as string[],
        defaultNS: 'common',
        detection: {
            order: ['localStorage', 'navigator'],
            lookupLocalStorage: 'pos_locale',
            caches: ['localStorage'],
        },
        interpolation: { escapeValue: false },
    });

export default i18n;
