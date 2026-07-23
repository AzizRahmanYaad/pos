@php
    /** @var \Illuminate\Support\Collection $expenses */
    /** @var \App\Models\BusinessSetting $settings */
    /** @var \Illuminate\Support\Collection $categoryTotals */
    $sym = $settings->currency_symbol ?: '';
    $money = fn ($v) => number_format((float) $v, 2) . ($sym ? ' ' . $sym : '');
    $fmtDate = fn ($d) => $d ? \Illuminate\Support\Carbon::parse($d)->format('Y-m-d') : null;
    $rangeFrom = $fmtDate($from);
    $rangeTo = $fmtDate($to);
    $subtitle = ($rangeFrom || $rangeTo)
        ? e($rangeFrom ?? '…').' &nbsp;—&nbsp; '.e($rangeTo ?? '…')
        : e(__('All dates'));
    $subtitle .= ' &nbsp;•&nbsp; '.e(__('Generated')).': '.now()->format('Y-m-d');
@endphp
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    @include('pdf.partials.styles')
</head>
<body>
    @include('pdf.partials.letterhead', [
        'title' => __('Expenses Report'),
        'subtitle' => $subtitle,
    ])

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
