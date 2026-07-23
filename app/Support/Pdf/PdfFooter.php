<?php

namespace App\Support\Pdf;

use App\Models\BusinessSetting;

/**
 * The footer every generated PDF shares: a thin brand hairline, the
 * company name with page numbers, and — when the owner has set one in
 * Settings — their own custom footer line (e.g. a tax ID, a thank-you
 * note, banking details). One place to build it so every document
 * (invoices, statements, and every report export) stays in sync.
 */
class PdfFooter
{
    public static function html(BusinessSetting $settings, bool $rtl): string
    {
        $company = e($settings->company_name ?: config('app.name'));
        $custom = trim((string) $settings->receipt_footer);

        $pageLabel = $rtl
            ? '{PAGENO} / {nbpg}'
            : __('Page').' {PAGENO} '.__('of').' {nbpg}';

        $customLine = $custom !== ''
            ? '<div style="margin-top:3px;color:#6b7280;font-style:italic;">'.nl2br(e($custom)).'</div>'
            : '';

        return <<<HTML
            <div style="text-align:center;font-size:9px;line-height:1.5;padding-top:6px;">
                <div style="height:2px;background-image:linear-gradient(90deg,#0f4a3b 0%,#1e6f5c 45%,#e3bc45 100%);width:100%;margin-bottom:5px;"></div>
                <div style="color:#4b5563;"><strong>{$company}</strong>&nbsp;&nbsp;•&nbsp;&nbsp;{$pageLabel}</div>
                {$customLine}
            </div>
            HTML;
    }
}
