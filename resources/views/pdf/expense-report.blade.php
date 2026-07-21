@php
    /** @var \Illuminate\Support\Collection $expenses */
    /** @var \App\Models\BusinessSetting $settings */
    /** @var \Illuminate\Support\Collection $categoryTotals */
    $sym = $settings->currency_symbol ?: '';
    $money = fn ($v) => number_format((float) $v, 2) . ($sym ? ' ' . $sym : '');
    $fmtDate = fn ($d) => $d ? \Illuminate\Support\Carbon::parse($d)->format('Y-m-d') : null;
    $rangeFrom = $fmtDate($from);
    $rangeTo = $fmtDate($to);
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
        .section-title { font-size: 12px; font-weight: bold; color: #10493c; margin: 18px 0 6px; }
        table.data { width: 100%; border-collapse: collapse; margin-top: 6px; }
        table.data thead th { background: #10493c; color: #ffffff; font-size: 10px; padding: 7px 8px; text-align: left; }
        table.data thead th.num { text-align: right; }
        table.data tbody td { padding: 6px 8px; border-bottom: 1px solid #eef2f1; font-size: 10px; }
        table.data tbody tr:nth-child(even) td { background: #f8faf9; }
        td.num { text-align: right; }
        tr.subtotal td { font-weight: bold; background: #eef5f2 !important; border-top: 1px solid #cfe0d9; }
        .summary-box { border: 1px solid #cfe0d9; border-radius: 6px; padding: 10px 14px; background: #f2f8f5;
            margin-top: 10px; }
        .summary-row { font-size: 15px; font-weight: bold; color: #10493c; }
        .muted { color: #6b7280; }
        .empty { color: #9ca3af; padding: 14px; text-align: center; font-style: italic; }
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

    <div class="doc-title">{{ __('Expenses Report') }}</div>
    <div class="doc-sub">
        @if ($rangeFrom || $rangeTo)
            {{ $rangeFrom ?? '…' }} &nbsp;—&nbsp; {{ $rangeTo ?? '…' }}
        @else
            {{ __('All dates') }}
        @endif
        &nbsp;•&nbsp; {{ __('Generated') }}: {{ now()->format('Y-m-d') }}
    </div>

    <div class="section-title">{{ __('By category') }}</div>
    <table class="data">
        <thead>
            <tr>
                <th style="width: 60%;">{{ __('Category') }}</th>
                <th class="num" style="width: 15%;">{{ __('Count') }}</th>
                <th class="num" style="width: 25%;">{{ __('Total') }}</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($categoryTotals as $row)
                <tr>
                    <td>{{ $row['name'] }}</td>
                    <td class="num">{{ $row['count'] }}</td>
                    <td class="num">{{ $money($row['total']) }}</td>
                </tr>
            @empty
                <tr><td colspan="3" class="empty">{{ __('No expenses in this period') }}</td></tr>
            @endforelse
            @if ($categoryTotals->isNotEmpty())
                <tr class="subtotal">
                    <td>{{ __('Grand Total') }}</td>
                    <td class="num">{{ $expenses->count() }}</td>
                    <td class="num">{{ $money($grandTotal) }}</td>
                </tr>
            @endif
        </tbody>
    </table>

    <div class="section-title">{{ __('Details') }}</div>
    <table class="data">
        <thead>
            <tr>
                <th style="width: 16%;">{{ __('Date') }}</th>
                <th style="width: 24%;">{{ __('Category') }}</th>
                <th style="width: 36%;">{{ __('Description') }}</th>
                <th class="num" style="width: 24%;">{{ __('Amount') }}</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($expenses as $expense)
                <tr>
                    <td>{{ \Illuminate\Support\Carbon::parse($expense->expense_date)->format('Y-m-d') }}</td>
                    <td>{{ $expense->category?->name ?? '—' }}</td>
                    <td>{{ $expense->description ?: '—' }}</td>
                    <td class="num">{{ $money($expense->amount) }}</td>
                </tr>
            @empty
                <tr><td colspan="4" class="empty">{{ __('No expenses in this period') }}</td></tr>
            @endforelse
        </tbody>
    </table>

    @if ($expenses->isNotEmpty())
        <div class="summary-box">
            <table style="width: 100%;">
                <tr>
                    <td class="summary-row">{{ __('Grand Total') }}</td>
                    <td class="summary-row num" style="text-align: right;">{{ $money($grandTotal) }}</td>
                </tr>
            </table>
        </div>
    @endif
</body>
</html>
