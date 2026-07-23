<?php

namespace App\Support;

use App\Models\BusinessSetting;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Mpdf\Mpdf;

/**
 * Renders a professional, WhatsApp-shareable account statement PDF for a
 * customer's or supplier's ledger, with the business as the letterhead
 * and a company-name footer.
 */
class LedgerStatementPdf
{
    /**
     * @param  Model  $party  a Customer, Supplier, or CashAccount
     * @param  Collection<int, \App\Models\LedgerEntry>  $entries  chronological
     * @param  'customer'|'supplier'|'cash_account'  $kind
     */
    public function build(Model $party, Collection $entries, string $kind): string
    {
        $settings = BusinessSetting::current();

        $totalDebit = (float) $entries->where('entry_type', 'debit')->sum('amount');
        $totalCredit = (float) $entries->where('entry_type', 'credit')->sum('amount');
        // Ledger convention is the same for both parties: a positive
        // running balance means the party owes the shop, negative means the
        // shop owes the party. The blade adapts the wording per kind.
        $owedToShop = round((float) $party->currentBalance(), 2);

        $html = view('pdf.ledger-statement', [
            'party' => $party,
            'entries' => $entries,
            'settings' => $settings,
            'kind' => $kind,
            'totalDebit' => $totalDebit,
            'totalCredit' => $totalCredit,
            'owedToShop' => $owedToShop,
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
