@php
    /** @var \App\Models\BusinessSetting $settings */
    /** @var array $data */
    $sym = $settings->currency_symbol ?: '';
    $money = fn ($v) => number_format((float) $v, 2) . ($sym ? ' ' . $sym : '');
    $netPositive = (float) $data['net_profit'] >= 0;
@endphp
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        * { font-family: sans-serif; }
        body { color: #1f2937; font-size: 11px; }
        .brandbar { background: #1e6f5c; color: #ffffff; padding: 14px 18px; border-radius: 6px; }
        .brand-name { font-size: 21px; font-weight: bold; }
        .brand-meta { font-size: 10px; color: #d7ece5; margin-top: 3px; line-height: 1.5; }
        .doc-title { font-size: 16px; font-weight: bold; color: #10493c; margin: 16px 0 2px; }
        .doc-sub { font-size: 10px; color: #6b7280; }
        table.statement { width: 100%; border-collapse: collapse; margin-top: 18px; }
        table.statement td { padding: 9px 10px; font-size: 12px; border-bottom: 1px solid #eef2f1; }
        table.statement td.num { text-align: right; }
        tr.subtotal td { font-weight: bold; background: #f8faf9; border-top: 1px solid #cfe0d9; }
        tr.deduction td.label { color: #6b7280; }
        tr.deduction td.num { color: #b3261e; }
        tr.net td { border-top: 3px double #10493c; font-weight: bold; font-size: 15px; padding-top: 12px; }
        tr.net td.num.positive { color: #1e6f5c; }
        tr.net td.num.negative { color: #b3261e; }
    </style>
</head>
<body>
    <div class="brandbar">
        <div class="brand-name">{{ $settings->company_name ?: config('app.name') }}</div>
        <div class="brand-meta">
            @if ($settings->address){{ $settings->address }}@endif
            @if ($settings->phone) &nbsp;•&nbsp; {{ $settings->phone }} @endif
            @if ($settings->email) &nbsp;•&nbsp; {{ $settings->email }} @endif
        </div>
    </div>

    <div class="doc-title">{{ __('Profit & Loss Statement') }}</div>
    <div class="doc-sub">
        {{ $data['from'] }} &nbsp;—&nbsp; {{ $data['to'] }}
        &nbsp;•&nbsp; {{ __('Generated') }}: {{ now()->format('Y-m-d') }}
    </div>

    <table class="statement">
        <tr>
            <td class="label">{{ __('Revenue') }}</td>
            <td class="num">{{ $money($data['revenue']) }}</td>
        </tr>
        <tr class="deduction">
            <td class="label">{{ __('Cost of goods sold') }}</td>
            <td class="num">−{{ $money($data['cogs']) }}</td>
        </tr>
        <tr class="subtotal">
            <td>{{ __('Gross profit') }}</td>
            <td class="num">{{ $money($data['gross_profit']) }}</td>
        </tr>
        <tr class="deduction">
            <td class="label">{{ __('Operating expenses') }}</td>
            <td class="num">−{{ $money($data['operating_expenses']) }}</td>
        </tr>
        <tr class="deduction">
            <td class="label">{{ __('Payroll cost') }}</td>
            <td class="num">−{{ $money($data['payroll_cost']) }}</td>
        </tr>
        <tr class="net">
            <td>{{ $netPositive ? __('Net profit') : __('Net loss') }}</td>
            <td class="num {{ $netPositive ? 'positive' : 'negative' }}">{{ $money($data['net_profit']) }}</td>
        </tr>
    </table>
</body>
</html>
