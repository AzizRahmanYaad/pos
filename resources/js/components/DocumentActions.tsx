import { CircularProgress, IconButton, Stack, Tooltip } from '@mui/material';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { useTranslation } from 'react-i18next';

/**
 * A little under a third off MUI's "small" icon, asked for directly.
 *
 * The button keeps its own padding rather than shrinking with the glyph:
 * the icon is what needed to be quieter, and a control this size is already
 * near the smallest a finger can reliably find on a tablet at the counter.
 */
const ICON_SCALE = 0.7;
const ICON_SIZE = `${1.25 * ICON_SCALE}rem`; // 0.875rem
/** Matched to the glyph, so swapping in a spinner never shifts the row. */
const SPINNER_PX = 15;

interface DocumentActionsProps {
    /** Omitted on screens that have nothing to send to a printer. */
    onPrint?: () => void;
    onPdf: () => void;
    onWhatsApp: () => void;
    /** A document being fetched: all three wait together, as they share it. */
    busy?: boolean;
    disabled?: boolean;
}

/**
 * Print, PDF and WhatsApp, on every screen that produces a document.
 *
 * Small and wordless on purpose. These sit at the top of pages whose job is
 * to show a sale, a statement, a delivery — and as full-width labelled
 * buttons they were the loudest thing on the screen, competing with the
 * figures somebody actually opened the page to read. The meaning is not
 * lost with the label: each carries a tooltip and an accessible name, the
 * same bargain the add button on every list screen already makes.
 *
 * One component rather than seven copies, because seven copies is how the
 * ledger ended up with a small icon for its PDF and a full green button
 * beside it — the same row, drawn two different ways, on one page.
 */
export function DocumentActions({ onPrint, onPdf, onWhatsApp, busy = false, disabled = false }: DocumentActionsProps) {
    const { t } = useTranslation();
    const off = busy || disabled;

    // Kept at the icon's own size so a spinner never resizes the row —
    // buttons that shuffle sideways mid-tap get the wrong one pressed.
    const spinner = <CircularProgress size={SPINNER_PX} color="inherit" />;

    return (
        <Stack direction="row" spacing={0.5} alignItems="center">
            {onPrint && (
                <Tooltip title={t('purchases_page.print')}>
                    <span>
                        <IconButton size="small" aria-label={t('purchases_page.print')} disabled={off} onClick={onPrint}>
                            {busy ? spinner : <PrintOutlinedIcon sx={{ fontSize: ICON_SIZE }} />}
                        </IconButton>
                    </span>
                </Tooltip>
            )}
            <Tooltip title={t('ledger.download_pdf')}>
                <span>
                    <IconButton size="small" aria-label={t('ledger.download_pdf')} disabled={off} onClick={onPdf}>
                        {busy ? spinner : <PictureAsPdfOutlinedIcon sx={{ fontSize: ICON_SIZE }} />}
                    </IconButton>
                </span>
            </Tooltip>
            <Tooltip title={t('ledger.whatsapp')}>
                <span>
                    <IconButton
                        size="small"
                        aria-label={t('ledger.whatsapp')}
                        disabled={off}
                        onClick={onWhatsApp}
                        // WhatsApp's own green, so the one action that leaves
                        // the app is still recognisable at this size.
                        sx={{ color: '#25D366', '&:hover': { bgcolor: 'rgba(37, 211, 102, 0.08)' } }}
                    >
                        {busy ? spinner : <WhatsAppIcon sx={{ fontSize: ICON_SIZE }} />}
                    </IconButton>
                </span>
            </Tooltip>
        </Stack>
    );
}
