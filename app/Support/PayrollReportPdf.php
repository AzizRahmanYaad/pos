<?php

namespace App\Support;

use App\Models\BusinessSetting;
use App\Models\PayrollRun;
use App\Support\Pdf\PdfFooter;
use Mpdf\Mpdf;

/**
 * Renders a professional, printable & WhatsApp-shareable payroll report PDF
 * for a run: every employee's base salary, deductions, bonuses and net pay,
 * plus column totals, with the business as the letterhead and a company-name
 * footer.
 */
class PayrollReportPdf
{
    public function build(PayrollRun $run): string
    {
        $settings = BusinessSetting::current();

        $run->loadMissing(['employee', 'items.employee']);

        $html = view('pdf.payroll-report', [
            'run' => $run,
            'items' => $run->items,
            'settings' => $settings,
            'totalBase' => (float) $run->items->sum('base_salary'),
            'totalAdvances' => (float) $run->items->sum('advances_deducted'),
            'totalDeductions' => (float) $run->items->sum('other_deductions'),
            'totalBonuses' => (float) $run->items->sum('bonuses'),
            'totalNet' => (float) $run->items->sum('net_pay'),
        ])->render();

        $rtl = in_array(app()->getLocale(), ['ps', 'prs'], true);

        $tempDir = storage_path('app/mpdf');
        if (! is_dir($tempDir)) {
            mkdir($tempDir, 0775, true);
        }

        $mpdf = new Mpdf([
            'mode' => 'utf-8',
            'format' => 'A4',
            'orientation' => 'L',
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
