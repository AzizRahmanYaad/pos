{{--
    Shared letterhead: a gold ribbon over a brand-gradient bar with the
    company's own details, then the document title with its accent rule.
    Variables:
      $settings (BusinessSetting) — required
      $title (string) — required, e.g. "Sale Invoice"
      $subtitle (string|HTML, optional) — reference number / date / status line
--}}
<div class="ribbon"></div>
<div class="brandbar">
    <div class="brand-name">{{ $settings->company_name ?: config('app.name') }}</div>
    <div class="brand-meta">
        @if ($settings->address){{ $settings->address }}@endif
        @if ($settings->phone) &nbsp;•&nbsp; {{ $settings->phone }} @endif
        @if ($settings->email) &nbsp;•&nbsp; {{ $settings->email }} @endif
    </div>
    <div class="brand-rule"></div>
</div>

<div class="doc-title">{{ $title }}</div>
@isset($subtitle)
    <div class="doc-sub">{!! $subtitle !!}</div>
@endisset
