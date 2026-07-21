import { useEffect, useState } from 'react';
import { Box, MenuItem, Stack, TextField, Typography } from '@mui/material';
import jalaali from 'jalaali-js';
import { useTranslation } from 'react-i18next';

const JALALI_MONTHS = [
    'حمل', 'ثور', 'جوزا', 'سرطان', 'اسد', 'سنبله',
    'میزان', 'عقرب', 'قوس', 'جدی', 'دلو', 'حوت',
];

function pad(value: number): string {
    return String(value).padStart(2, '0');
}

interface JalaliParts {
    jy: string;
    jm: string;
    jd: string;
}

const EMPTY: JalaliParts = { jy: '', jm: '', jd: '' };

function isoToJalali(iso: string): JalaliParts {
    if (!iso) return EMPTY;
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return EMPTY;
    try {
        const { jy, jm, jd } = jalaali.toJalaali(y, m, d);
        return { jy: String(jy), jm: String(jm), jd: String(jd) };
    } catch {
        return EMPTY;
    }
}

function jalaliToIso(parts: JalaliParts): string | null {
    const jy = Number(parts.jy);
    const jm = Number(parts.jm);
    const jd = Number(parts.jd);
    if (!jy || !jm || !jd) return null;
    if (!jalaali.isValidJalaaliDate(jy, jm, jd)) return null;
    const { gy, gm, gd } = jalaali.toGregorian(jy, jm, jd);
    return `${gy}-${pad(gm)}-${pad(gd)}`;
}

interface DualDateFieldProps {
    label: string;
    /** ISO Gregorian date, e.g. "2026-07-21", or "" when empty. */
    value: string;
    onChange: (iso: string) => void;
    size?: 'small' | 'medium';
    fullWidth?: boolean;
}

/**
 * A date field that can be entered in either the Gregorian or the Hijri
 * Shamsi (Solar Hijri / Jalali) calendar — the two stay in sync and the
 * value emitted is always an ISO Gregorian date. Used across the app so
 * Afghan users can pick dates in whichever calendar they think in.
 */
export function DualDateField({ label, value, onChange, size = 'small', fullWidth }: DualDateFieldProps) {
    const { t } = useTranslation();
    const [jalali, setJalali] = useState<JalaliParts>(() => isoToJalali(value));

    // Keep the Jalali inputs in step when the Gregorian value changes from
    // the outside (e.g. cleared, or set by the Gregorian picker).
    useEffect(() => {
        setJalali(isoToJalali(value));
    }, [value]);

    const updateJalali = (next: JalaliParts) => {
        setJalali(next);
        const iso = jalaliToIso(next);
        if (iso) onChange(iso);
        else if (!next.jy && !next.jm && !next.jd) onChange('');
    };

    return (
        <Box sx={{ width: fullWidth ? '100%' : 'auto' }}>
            <TextField
                type="date"
                label={`${label} — ${t('calendar.gregorian')}`}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                size={size}
                fullWidth
                InputLabelProps={{ shrink: true }}
            />
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <TextField
                    label={t('calendar.year')}
                    value={jalali.jy}
                    onChange={(e) => updateJalali({ ...jalali, jy: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    size={size}
                    sx={{ width: 84 }}
                    inputProps={{ inputMode: 'numeric' }}
                />
                <TextField
                    select
                    label={t('calendar.month')}
                    value={jalali.jm}
                    onChange={(e) => updateJalali({ ...jalali, jm: e.target.value })}
                    size={size}
                    sx={{ minWidth: 104, flex: 1 }}
                >
                    {JALALI_MONTHS.map((name, i) => (
                        <MenuItem key={name} value={String(i + 1)}>
                            {name}
                        </MenuItem>
                    ))}
                </TextField>
                <TextField
                    label={t('calendar.day')}
                    value={jalali.jd}
                    onChange={(e) => updateJalali({ ...jalali, jd: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                    size={size}
                    sx={{ width: 72 }}
                    inputProps={{ inputMode: 'numeric' }}
                />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: 'block' }}>
                {t('calendar.hijri_shamsi')}
            </Typography>
        </Box>
    );
}
