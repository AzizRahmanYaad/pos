import jalaali from 'jalaali-js';
import { isRtl } from '@/i18n/i18n';

const JALALI_MONTHS = [
    'حمل', 'ثور', 'جوزا', 'سرطان', 'اسد', 'سنبله',
    'میزان', 'عقرب', 'قوس', 'جدی', 'دلو', 'حوت',
];

function pad(value: number): string {
    return String(value).padStart(2, '0');
}

/**
 * Formats a date for display. Gregorian for English, Jalali (solar Hijri) for
 * Pashto/Dari — the calendar system used across Afghanistan.
 */
export function formatDate(value: string | Date | null | undefined, locale: string): string {
    if (!value) return '';

    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '';

    if (!isRtl(locale)) {
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    const { jy, jm, jd } = jalaali.toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());

    return `${jy}-${pad(jm)}-${pad(jd)}`;
}

export function formatDateLong(value: string | Date | null | undefined, locale: string): string {
    if (!value) return '';

    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '';

    if (!isRtl(locale)) {
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    const { jy, jm, jd } = jalaali.toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());

    return `${jd} ${JALALI_MONTHS[jm - 1]} ${jy}`;
}
