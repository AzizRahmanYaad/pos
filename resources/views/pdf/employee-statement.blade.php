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
    <style>
        * { font-family: sans-serif; }
        body { color: #1f2937; font-size: 11px; }
        .brandbar { background: #1e6f5c; color: #ffffff; padding: 14px 18px; border-radius: 6px; }
        .brand-name { font-size: 21px; font-weight: bold; }
        .brand-meta { font-size: 10px; color: #d7ece5; margin-top: 3px; line-height: 1.5; }
        .doc-title { font-size: 16px; font-weight: bold; color: #10493c; margin: 16px 0 2px; }
        .doc-sub { font-size: 10px; color: #6b7280; }
        .meta-table { width: 100%; margin-top: 14px; }
        .meta-table td { vertical-align: top; }
        .box { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; background: #f8faf9; }
        .label { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
        .party-name { font-size: 14px; font-weight: bold; color: #111827; }
        .party-line { font-size: 10px; color: #4b5563; margin-top: 2px; }
        .balance-box { border-radius: 6px; padding: 10px 12px; text-align: center; color: #ffffff; }
        .balance-amt { font-size: 18px; font-weight: bold; }
        .balance-cap { font-size: 9px; opacity: 0.9; }
        table.ledger { width: 100%; border-collapse: collapse; margin-top: 16px; }
        table.ledger thead th { background: #10493c; color: #ffffff; font-size: 10px; padding: 7px 8px; text-align: left; }
        table.ledger thead th.num { text-align: right; }
        table.ledger tbody td { padding: 6px 8px; border-bottom: 1px solid #eef2f1; font-size: 10px; }
        table.ledger tbody tr:nth-child(even) td { background: #f8faf9; }
        td.num { text-align: right; }
        .credit { color: #1e6f5c; }
        .debit { color: #b3261e; }
        .muted { color: #6b7280; }
        .empty { color: #9ca3af; padding: 14px; text-align: center; font-style: italic; }
        table.totals { width: 46%; border-collapse: collapse; margin-top: 12px; float: right; }
        table.totals td { padding: 5px 8px; font-size: 11px; }
        table.totals tr.net td { border-top: 2px solid #10493c; font-weight: bold; font-size: 13px; color: #10493c; }
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

    <div class="doc-title">{{ __('Employee Statement') }}</div>
    <div class="doc-sub">{{ __('Generated') }}: {{ now()->format('Y-m-d') }}</div>

    <table class="meta-table">
        <tr>
            <td style="width: 58%; padding-right: 12px;">
                <div class="box">
                    <div class="label">{{ __('Employee') }}</div>
                    <div class="party-name">{{ $employee->name }}</div>
                    @if ($employee->designation)<div class="party-line">{{ $employee->designation }}</div>@endif
                    @if ($employee->phone)<div class="party-line">{{ $employee->phone }}</div>@endif
                    <div class="party-line">{{ __('Salary') }}: {{ $money($employee->salary_amount) }} / {{ $salaryType }}</div>
                </div>
            </td>
            <td style="width: 42%;">
                <div class="balance-box" style="background: {{ $advBg }};">
                    <div class="balance-amt">{{ $money($outstandingAdvances) }}</div>
                    <div class="balance-cap">{{ $advCap }}</div>
                </div>
            </td>
        </tr>
    </table>

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
