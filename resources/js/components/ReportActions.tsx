import { useState } from 'react';
import { Button, Stack, Tooltip } from '@mui/material';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { useTranslation } from 'react-i18next';

interface DownloadResult {
    url: string;
    filename: string;
    blob: Blob;
}

interface ReportActionsProps {
    download: () => Promise<DownloadResult>;
    /** Message used when sharing to WhatsApp. */
    message?: string;
    size?: 'small' | 'medium' | 'large';
}

/**
 * The shared Print / PDF / WhatsApp action row used across list and detail
 * reports, so every printable document behaves the same way.
 */
export function ReportActions({ download, message, size = 'medium' }: ReportActionsProps) {
    const { t } = useTranslation();
    const [busy, setBusy] = useState(false);

    const openPdf = async (print: boolean) => {
        setBusy(true);
        try {
            const { url } = await download();
            const win = window.open(url, '_blank');
            if (print && win) {
                win.addEventListener('load', () => setTimeout(() => win.print(), 400));
            }
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } finally {
            setBusy(false);
        }
    };

    const shareWhatsApp = async () => {
        setBusy(true);
        try {
            const { url, filename, blob } = await download();
            const file = new File([blob], filename, { type: 'application/pdf' });
            const text = message ?? filename;

            const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
            if (nav.canShare?.({ files: [file] })) {
                try {
                    await nav.share({ files: [file], text });
                    return;
                } catch {
                    /* cancelled */
                }
            }

            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = filename;
            anchor.click();
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="outlined" size={size} startIcon={<PrintOutlinedIcon />} disabled={busy} onClick={() => openPdf(true)}>
                {t('purchases_page.print')}
            </Button>
            <Tooltip title={t('ledger.download_pdf')}>
                <span>
                    <Button
                        variant="outlined"
                        size={size}
                        startIcon={<PictureAsPdfOutlinedIcon />}
                        disabled={busy}
                        onClick={() => openPdf(false)}
                    >
                        PDF
                    </Button>
                </span>
            </Tooltip>
            <Button
                variant="contained"
                size={size}
                startIcon={<WhatsAppIcon />}
                disabled={busy}
                onClick={shareWhatsApp}
                sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#1da851' } }}
            >
                {t('ledger.whatsapp')}
            </Button>
        </Stack>
    );
}
