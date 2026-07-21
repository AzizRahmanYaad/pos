@php
    /** @var \App\Models\PayrollRun $run */
    /** @var \Illuminate\Support\Collection $items */
    /** @var \App\Models\BusinessSetting $settings */
    $sym = $settings->currency_symbol ?: '';
    $money = fn ($v) => number_format((float) $v, 2) . ($sym ? ' ' . $sym : '');
    $months = [1 => __('January'), 2 => __('February'), 3 => __('March'), 4 => __('April'),
        5 => __('May'), 6 => __('June'), 7 => __('July'), 8 => __('August'),
        9 => __('September'), 10 => __('October'), 11 => __('November'), 12 => __('December')];
    $period = ($months[$run->period_month] ?? $run->period_month).' '.$run->period_year;
    $statusColors = ['draft' => '#4b5563', 'paid' => '#1e6f5c'];
    $statusBg = $statusColors[$run->status] ?? '#4b5563';
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
        .status-pill { display: inline-block; color: #fff; font-size: 10px; font-weight: bold;
            padding: 3px 10px; border-radius: 10px; }
        table.items { width: 100%; border-collapse: collapse; margin-top: 14px; }
        table.items thead th { background: #10493c; color: #ffffff; font-size: 10px; padding: 7px 8px; text-align: left; }
        table.items thead th.num { text-align: right; }
        table.items tbody td { padding: 6px 8px; border-bottom: 1px solid #eef2f1; font-size: 10px; }
        table.items tbody tr:nth-child(even) td { background: #f8faf9; }
        td.num { text-align: right; }
        tr.totals td { font-weight: bold; background: #eef5f2 !important; border-top: 2px solid #10493c;
            font-size: 11px; color: #10493c; }
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

    <div class="doc-title">{{ __('Payroll Report') }}</div>
    <div class="doc-sub">
        {{ $period }}
        &nbsp;•&nbsp; <span class="status-pill" style="background: {{ $statusBg }};">{{ __(ucfirst($run->status)) }}</span>
        &nbsp;•&nbsp; {{ __('Generated') }}: {{ now()->format('Y-m-d') }}
    </div>

    <table class="items">
        <thead>
            <tr>
                <th style="width: 28%;">{{ __('Employee') }}</th>
                <th class="num" style="width: 18%;">{{ __('Base salary') }}</th>
                <th class="num" style="width: 18%;">{{ __('Advances deducted') }}</th>
                <th class="num" style="width: 12%;">{{ __('Deductions') }}</th>
                <th class="num" style="width: 12%;">{{ __('Bonuses') }}</th>
                <th class="num" style="width: 12%;">{{ __('Net pay') }}</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($items as $item)
                <tr>
                    <td>{{ $item->employee?->name ?? '—' }}</td>
                    <td class="num">{{ $money($item->base_salary) }}</td>
                    <td class="num">{{ $money($item->advances_deducted) }}</td>
                    <td class="num">{{ $money($item->other_deductions) }}</td>
                    <td class="num">{{ $money($item->bonuses) }}</td>
                    <td class="num">{{ $money($item->net_pay) }}</td>
                </tr>
            @empty
                <tr><td colspan="6" class="empty">{{ __('No employees in this run') }}</td></tr>
            @endforelse
            @if ($items->isNotEmpty())
                <tr class="totals">
                    <td>{{ __('Grand Total') }}</td>
                    <td class="num">{{ $money($totalBase) }}</td>
                    <td class="num">{{ $money($totalAdvances) }}</td>
                    <td class="num">{{ $money($totalDeductions) }}</td>
                    <td class="num">{{ $money($totalBonuses) }}</td>
                    <td class="num">{{ $money($totalNet) }}</td>
                </tr>
            @endif
        </tbody>
    </table>
</body>
</html>
