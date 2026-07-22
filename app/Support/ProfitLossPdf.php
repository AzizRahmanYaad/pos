<?php

namespace App\Support;

use App\Models\BusinessSetting;
use Mpdf\Mpdf;

/**
 * Renders a professional, printable & WhatsApp-shareable Profit & Loss
 * statement PDF for a date range, with the business as the letterhead and
 * a company-name footer.
 */
class ProfitLossPdf
{
    /**
     * @param  array{from:string,to:string,revenue:float,cogs:float,gross_profit:float,operating_expenses:float,operating_expenses_by_category:array<int,array{category:string,total:float}>,payroll_cost:float,net_profit:float}  $data
     */
    public function build(array $data): string
    {
        $settings = BusinessSetting::current();

        $html = view('pdf.profit-loss', [
            'settings' => $settings,
            'data' => $data,
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
