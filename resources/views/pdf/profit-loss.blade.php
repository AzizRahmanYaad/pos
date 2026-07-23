@php
    /** @var \App\Models\BusinessSetting $settings */
    /** @var array $data */
    $sym = $settings->currency_symbol ?: '';
    $money = fn ($v) => number_format((float) $v, 2) . ($sym ? ' ' . $sym : '');
    $netPositive = (float) $data['net_profit'] >= 0;
    $categories = $data['operating_expenses_by_category'] ?? [];
    $maxCategoryTotal = collect($categories)->max('total') ?: 1;
@endphp
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    @include('pdf.partials.styles')
    <style>
        table.statement { width: 100%; border-collapse: collapse; margin-top: 18px; }
        table.statement td { padding: 9px 10px; font-size: 12px; border-bottom: 1px solid #eef2f1; }
        table.statement td.num { text-align: right; }
        tr.subtotal td { font-weight: bold; background: #f8faf9; border-top: 1px solid #cfe0d9; }
        tr.deduction td.label { color: #6b7280; }
        tr.deduction td.num { color: #b3261e; }
        tr.section-header td { font-weight: bold; color: #10493c; padding-bottom: 3px; border-bottom: none; }
        tr.section-header td.num { color: #6b7280; font-weight: normal; font-size: 9px; text-transform: uppercase; letter-spacing: 0.4px; }
        tr.category-row td { padding: 5px 10px 5px 26px; font-size: 10px; color: #4b5563; border-bottom: none; }
        tr.category-row td.num { color: #b3261e; }
        tr.category-row .bar-track { background: #f1f5f3; border-radius: 3px; height: 5px; margin-top: 3px; width: 92%; }
        tr.category-row .bar-fill { background-color: #b8901f; background-image: linear-gradient(90deg, #b8901f, #e3bc45); border-radius: 3px; height: 5px; }
        tr.section-total td { font-weight: bold; border-top: 1px solid #e5e7eb; color: #374151; }
        tr.section-total td.num { color: #b3261e; }
        tr.net td { border-top: 3px double #10493c; font-weight: bold; font-size: 15px; padding-top: 12px; }
        tr.net td.num.positive { color: #1e6f5c; }
        tr.net td.num.negative { color: #b3261e; }

        {{-- Built with floats, not a table: mpdf renders a bordered block's
             border per text-line instead of as one box when nested inside a
             <td>, so the four cards float instead of sitting in table cells. --}}
        .snapshot { width: 100%; }
        .snapshot:after { content: ""; display: block; clear: both; }
        .snapshot .card { float: left; width: 25%; }
        .snapshot .card .box { margin-right: 8px; }
        .snapshot-amt { font-size: 14px; font-weight: bold; color: #111827; margin-top: 3px; }
    </style>
</head>
<body>
    @include('pdf.partials.letterhead', [
        'title' => __('Profit & Loss Statement'),
        'subtitle' => e($data['from']).' &nbsp;—&nbsp; '.e($data['to']).' &nbsp;•&nbsp; '.__('Generated').': '.now()->format('Y-m-d'),
    ])

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

        <tr class="section-header">
            <td>{{ __('Operating expenses by category') }}</td>
            <td class="num">{{ __('Amount') }}</td>
        </tr>
        @forelse ($categories as $category)
            <tr class="category-row">
                <td>
                    {{ $category['category'] }}
                    <div class="bar-track">
                        <div class="bar-fill" style="width: {{ $maxCategoryTotal > 0 ? round(($category['total'] / $maxCategoryTotal) * 100) : 0 }}%;"></div>
                    </div>
                </td>
                <td class="num">−{{ $money($category['total']) }}</td>
            </tr>
        @empty
            <tr class="category-row">
                <td colspan="2" style="color:#9ca3af;font-style:italic;">{{ __('No expenses in this period') }}</td>
            </tr>
        @endforelse
        <tr class="section-total">
            <td>{{ __('Total operating expenses') }}</td>
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

    <div class="section-title">{{ __('Financial Position (current)') }}</div>
    <div class="snapshot">
        <div class="card">
            <div class="box">
                <div class="label">{{ __('Cash Balance') }}</div>
                <div class="snapshot-amt">{{ $money($data['cash_balance']) }}</div>
            </div>
        </div>
        <div class="card">
            <div class="box">
                <div class="label">{{ __('Inventory Value') }}</div>
                <div class="snapshot-amt">{{ $money($data['inventory_value']) }}</div>
            </div>
        </div>
        <div class="card">
            <div class="box">
                <div class="label">{{ __('Accounts Receivable') }}</div>
                <div class="snapshot-amt">{{ $money($data['receivables_total']) }}</div>
            </div>
        </div>
        <div class="card">
            <div class="box">
                <div class="label">{{ __('Accounts Payable') }}</div>
                <div class="snapshot-amt">{{ $money($data['payables_total']) }}</div>
            </div>
        </div>
    </div>
</body>
</html>
