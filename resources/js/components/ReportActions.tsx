import { useState } from 'react';
import { DocumentActions } from '@/components/DocumentActions';
import { downloadOrToast } from '@/lib/reportDownload';

interface DownloadResult {
    url: string;
    filename: string;
    blob: Blob;
}

interface ReportActionsProps {
    /** Omit (or pass undefined) when there's nothing ready to export yet — the actions render disabled. */
    download?: () => Promise<DownloadResult>;
    /** Message used when sharing to WhatsApp. */
    message?: string;
}

/**
 * The shared Print / PDF / WhatsApp action row used across list and detail
 * reports, so every printable document behaves the same way.
 */
export function ReportActions({ download, message }: ReportActionsProps) {
    const [busy, setBusy] = useState(false);

    const openPdf = async (print: boolean) => {
        if (!download) return;
        setBusy(true);
        try {
            const result = await downloadOrToast(download);
            if (!result) return;
            const { url } = result;
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
        if (!download) return;
        setBusy(true);
        try {
            const result = await downloadOrToast(download);
            if (!result) return;
            const { url, filename, blob } = result;
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
        <DocumentActions
            onPrint={() => openPdf(true)}
            onPdf={() => openPdf(false)}
            onWhatsApp={shareWhatsApp}
            busy={busy}
            disabled={!download}
        />
    );
}
