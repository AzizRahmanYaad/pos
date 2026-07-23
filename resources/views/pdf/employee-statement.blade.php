@php
    /** @var \App\Models\Employee $employee */
    /** @var \Illuminate\Support\Collection $entries */
    /** @var \App\Models\BusinessSetting $settings */
    $sym = $settings->currency_symbol ?: '';
    $money = fn ($v) => number_format((float) $v, 2) . ($sym ? ' ' . $sym : '');
    $advBg = $outstandingAdvances > 0 ? '#b45309' : '#1e6f5c';
    $advCap = $outstandingAdvances > 0 ? __('Outstanding advances') : __('No outstanding advances');
    $salaryType = $employee->salary_type === 'daily' ? __('Daily') : __('Monthly');
@endphp
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    @include('pdf.partials.styles')
</head>
<body>
    @include('pdf.partials.letterhead', [
        'title' => __('Employee Statement'),
        'subtitle' => __('Generated').': '.now()->format('Y-m-d'),
    ])

    <div class="doc-head">
        <div class="col-main">
            <div class="box">
                <div class="label">{{ __('Employee') }}</div>
                <div class="party-name">{{ $employee->name }}</div>
                @if ($employee->designation)<div class="party-line">{{ $employee->designation }}</div>@endif
                @if ($employee->phone)<div class="party-line">{{ $employee->phone }}</div>@endif
                <div class="party-line">{{ __('Salary') }}: {{ $money($employee->salary_amount) }} / {{ $salaryType }}</div>
            </div>
        </div>
        <div class="col-side">
            <div class="balance-box" style="background: {{ $advBg }};">
                <div class="balance-amt">{{ $money($outstandingAdvances) }}</div>
                <div class="balance-cap">{{ $advCap }}</div>
            </div>
        </div>
    </div>

    <table class="ledger">
        <thead>
            <tr>
                <th style="width: 16%;">{{ __('Date') }}</th>
                <th style="width: 40%;">{{ __('Description') }}</th>
                <th class="num" style="width: 15%;">{{ __('Debit') }}</th>
                <th class="num" style="width: 15%;">{{ __('Credit') }}</th>
                <th class="num" style="width: 14%;">{{ __('Balance') }}</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($entries as $entry)
                <tr>
                    <td>{{ \Illuminate\Support\Carbon::parse($entry->transaction_date)->format('Y-m-d') }}</td>
                    <td>{{ $entry->description ?: '—' }}</td>
                    <td class="num debit">{{ $entry->entry_type === 'debit' ? $money($entry->amount) : '' }}</td>
                    <td class="num credit">{{ $entry->entry_type === 'credit' ? $money($entry->amount) : '' }}</td>
                    <td class="num">{{ $money($entry->running_balance) }}</td>
                </tr>
            @empty
                <tr><td colspan="5" class="empty">{{ __('No transactions yet') }}</td></tr>
            @endforelse
        </tbody>
    </table>

    <table class="totals">
        <tr>
            <td class="muted">{{ __('Total Debit') }}</td>
            <td class="num debit">{{ $money($totalDebit) }}</td>
        </tr>
        <tr>
            <td class="muted">{{ __('Total Credit') }}</td>
            <td class="num credit">{{ $money($totalCredit) }}</td>
        </tr>
        <tr class="net">
            <td>{{ __('Outstanding advances') }}</td>
            <td class="num">{{ $money($outstandingAdvances) }}</td>
        </tr>
    </table>
</body>
</html>
