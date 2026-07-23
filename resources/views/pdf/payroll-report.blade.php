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

    $subtitle = '';
    if ($run->employee) {
        $subtitle .= '<strong>'.e($run->employee->name).'</strong> &nbsp;•&nbsp; ';
    }
    $subtitle .= e($period);
    if ($run->period_date) {
        $subtitle .= ' &nbsp;•&nbsp; '.e(\App\Support\JalaliDate::monthYear($run->period_date)).' '.e(__('Hijri Shamsi'))
            .' &nbsp;•&nbsp; '.\Illuminate\Support\Carbon::parse($run->period_date)->format('Y-m-d');
    }
    $subtitle .= ' &nbsp;•&nbsp; <span class="status-pill" style="background: '.$statusBg.';">'.e(__(ucfirst($run->status))).'</span>';
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
        'title' => __('Payroll Report'),
        'subtitle' => $subtitle,
    ])

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
