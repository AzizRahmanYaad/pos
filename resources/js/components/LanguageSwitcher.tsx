import { MenuItem, Select, type SelectChangeEvent } from '@mui/material';
import { useLocaleStore } from '@/store/localeStore';
import type { SupportedLocale } from '@/i18n/i18n';

const LABELS: Record<SupportedLocale, string> = {
    en: 'English',
    ps: 'پښتو',
    prs: 'دری',
};

export function LanguageSwitcher() {
    const { locale, setLocale } = useLocaleStore();

    const handleChange = (event: SelectChangeEvent) => {
        setLocale(event.target.value as SupportedLocale);
    };

    return (
        <Select size="small" value={locale} onChange={handleChange} sx={{ minWidth: 120 }}>
            {(Object.keys(LABELS) as SupportedLocale[]).map((code) => (
                <MenuItem key={code} value={code}>
                    {LABELS[code]}
                </MenuItem>
            ))}
        </Select>
    );
}
