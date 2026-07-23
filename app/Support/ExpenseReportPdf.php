<?php

namespace App\Support;

use App\Models\BusinessSetting;
use Illuminate\Support\Collection;
use App\Support\Pdf\PdfFooter;
use Mpdf\Mpdf;

/**
 * Renders a professional, printable & WhatsApp-shareable expenses report
 * PDF for a date range, with a category-wise breakdown, an itemised list
 * and a grand total. The business is the letterhead and a company-name
 * footer closes each page.
 */
class ExpenseReportPdf
{
    /**
     * @param  Collection<int, \App\Models\Expense>  $expenses  chronological
     */
    public function build(Collection $expenses, ?string $from, ?string $to): string
    {
        $settings = BusinessSetting::current();

        $grandTotal = (float) $expenses->sum('amount');

        $categoryTotals = $expenses
            ->groupBy(fn ($expense) => $expense->category?->name ?? '—')
            ->map(fn ($group) => [
                'name' => $group->first()->category?->name ?? '—',
                'count' => $group->count(),
                'total' => (float) $group->sum('amount'),
            ])
            ->sortByDesc('total')
            ->values();

        $html = view('pdf.expense-report', [
            'expenses' => $expenses,
            'settings' => $settings,
            'from' => $from,
            'to' => $to,
            'grandTotal' => $grandTotal,
            'categoryTotals' => $categoryTotals,
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
