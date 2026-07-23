<?php

namespace Tests\Unit\Support;

use App\Models\BusinessSetting;
use App\Support\Pdf\PdfFooter;
use Tests\TestCase;

class PdfFooterTest extends TestCase
{
    public function test_html_includes_company_name_and_page_numbers(): void
    {
        $settings = new BusinessSetting(['company_name' => 'Acme Traders']);

        $html = PdfFooter::html($settings, false);

        $this->assertStringContainsString('Acme Traders', $html);
        $this->assertStringContainsString('{PAGENO}', $html);
        $this->assertStringContainsString('{nbpg}', $html);
    }

    public function test_html_includes_custom_receipt_footer_when_set(): void
    {
        $settings = new BusinessSetting([
            'company_name' => 'Acme Traders',
            'receipt_footer' => 'Thank you for your business!',
        ]);

        $html = PdfFooter::html($settings, false);

        $this->assertStringContainsString('Thank you for your business!', $html);
    }

    public function test_html_omits_custom_line_when_receipt_footer_is_empty(): void
    {
        $settings = new BusinessSetting(['company_name' => 'Acme Traders', 'receipt_footer' => '']);

        $htmlEmpty = PdfFooter::html($settings, false);

        $settings->receipt_footer = '   ';
        $htmlWhitespace = PdfFooter::html($settings, false);

        // Only the fixed company/page-number line should remain — no italic
        // custom-note markup was rendered for either the empty or the
        // whitespace-only footer.
        $this->assertStringNotContainsString('font-style:italic', $htmlEmpty);
        $this->assertStringNotContainsString('font-style:italic', $htmlWhitespace);
    }

    public function test_rtl_footer_omits_page_word_labels(): void
    {
        $settings = new BusinessSetting(['company_name' => 'Acme Traders']);

        $html = PdfFooter::html($settings, true);

        $this->assertStringContainsString('{PAGENO} / {nbpg}', $html);
    }

    public function test_falls_back_to_app_name_when_company_name_is_blank(): void
    {
        $settings = new BusinessSetting(['company_name' => '']);

        $html = PdfFooter::html($settings, false);

        $this->assertStringContainsString(config('app.name'), $html);
    }
}
