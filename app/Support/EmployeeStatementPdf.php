<?php

namespace App\Support;

use App\Models\BusinessSetting;
use App\Models\Employee;
use Illuminate\Support\Collection;
use App\Support\Pdf\PdfFooter;
use Mpdf\Mpdf;

/**
 * Renders a professional, printable & WhatsApp-shareable employee statement
 * PDF: salary details, outstanding advances and a chronological ledger of
 * advances, salary payments and adjustments, with the business as the
 * letterhead and a company-name footer.
 */
class EmployeeStatementPdf
{
    /**
     * @param  Collection<int, \App\Models\LedgerEntry>  $entries  chronological
     */
    public function build(Employee $employee, Collection $entries): string
    {
        $settings = BusinessSetting::current();

        $totalDebit = (float) $entries->where('entry_type', 'debit')->sum('amount');
        $totalCredit = (float) $entries->where('entry_type', 'credit')->sum('amount');

        $html = view('pdf.employee-statement', [
            'employee' => $employee,
            'entries' => $entries,
            'settings' => $settings,
            'totalDebit' => $totalDebit,
            'totalCredit' => $totalCredit,
            'outstandingAdvances' => round($employee->outstandingAdvanceTotal(), 2),
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
