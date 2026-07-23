<?php

namespace App\Support;

use App\Models\BusinessSetting;
use App\Models\Purchase;
use App\Support\Pdf\PdfFooter;
use Mpdf\Mpdf;

/**
 * Renders a professional, printable & WhatsApp-shareable purchase invoice
 * PDF, with the business as the letterhead and a company-name footer.
 */
class PurchaseInvoicePdf
{
    public function build(Purchase $purchase): string
    {
        $settings = BusinessSetting::current();

        $html = view('pdf.purchase-invoice', [
            'purchase' => $purchase,
            'settings' => $settings,
        ])->render();

        $rtl = in_array(app()->getLocale(), ['ps', 'prs'], true);

        $tempDir = storage_path('app/mpdf');
        if (! is_dir($tempDir)) {
            mkdir($tempDir, 0775, true);
        }

        $mpdf = new Mpdf([
            'mode' => 'utf-8',
            'format' => 'A4',
            'margin_top' => 16,
            'margin_bottom' => 20,
            'margin_left' => 14,
            'margin_right' => 14,
            'tempDir' => $tempDir,
            'autoScriptToLang' => true,
            'autoLangToFont' => true,
            'directionality' => $rtl ? 'rtl' : 'ltr',
        ]);

        $mpdf->SetHTMLFooter(PdfFooter::html($settings, $rtl));

        $mpdf->WriteHTML($html);

        return $mpdf->Output('', 'S');
    }
}
