<?php

namespace App\Support;

use App\Models\BusinessSetting;
use Mpdf\Mpdf;

/**
 * Renders a professional, printable & WhatsApp-shareable list report PDF —
 * the same branded design as the purchase invoice — for any tabular data
 * such as a customer directory or a product catalogue.
 */
class ListReportPdf
{
    /**
     * @param  array<int, array{label:string, align?:string, width?:string}>  $columns
     * @param  array<int, array<int, string>>  $rows
     */
    public function build(string $title, array $columns, array $rows, ?string $subtitle = null): string
    {
        $settings = BusinessSetting::current();

        $html = view('pdf.list-report', [
            'settings' => $settings,
            'title' => $title,
            'subtitle' => $subtitle,
            'columns' => $columns,
            'rows' => $rows,
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

        $company = e($settings->company_name ?: config('app.name'));
        $footer = $rtl
            ? '<div style="text-align:center;color:#9ca3af;font-size:9px;border-top:1px solid #e5e7eb;padding-top:4px;">'
                .$company.' &nbsp;—&nbsp; {PAGENO}/{nbpg}</div>'
            : '<div style="text-align:center;color:#9ca3af;font-size:9px;border-top:1px solid #e5e7eb;padding-top:4px;">'
                .$company.' &nbsp;—&nbsp; '.__('Page').' {PAGENO} '.__('of').' {nbpg}</div>';
        $mpdf->SetHTMLFooter($footer);

        $mpdf->WriteHTML($html);

        return $mpdf->Output('', 'S');
    }
}
