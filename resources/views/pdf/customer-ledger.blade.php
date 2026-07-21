@php
    /** @var \App\Models\Customer $customer */
    /** @var \Illuminate\Support\Collection $entries */
    /** @var \App\Models\BusinessSetting $settings */
    $sym = $settings->currency_symbol ?: '';
    $money = fn ($v) => number_format((float) $v, 2) . ($sym ? ' ' . $sym : '');
    $balance = round((float) $balance, 2);
@endphp
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        * { font-family: sans-serif; }
        body { color: #1f2937; font-size: 11px; }

        .brandbar { background: #1e6f5c; color: #ffffff; padding: 14px 18px; border-radius: 6px; }
        .brand-name { font-size: 21px; font-weight: bold; letter-spacing: 0.3px; }
        .brand-meta { font-size: 10px; color: #d7ece5; margin-top: 3px; line-height: 1.5; }

        .doc-title { font-size: 15px; font-weight: bold; color: #10493c; margin: 18px 0 2px; }
        .doc-sub { font-size: 10px; color: #6b7280; }

        .party-table { width: 100%; margin-top: 14px; }
        .party-table td { vertical-align: top; }
        .party-box {
            border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; background: #f8faf9;
        }
        .label { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
        .party-name { font-size: 13px; font-weight: bold; color: #111827; }
        .party-line { font-size: 10px; color: #4b5563; margin-top: 2px; }

        .balance-box {
            border-radius: 6px; padding: 10px 12px; text-align: center; color: #ffffff;
        }
        .balance-box.owe { background: #b3261e; }
        .balance-box.advance { background: #1e6f5c; }
        .balance-box.settled { background: #4b5563; }
        .balance-amt { font-size: 18px; font-weight: bold; }
        .balance-cap { font-size: 9px; opacity: 0.9; }

        table.ledger { width: 100%; border-collapse: collapse; margin-top: 16px; }
        table.ledger thead th {
            background: #10493c; color: #ffffff; font-size: 10px; padding: 7px 8px; text-align: left;
        }
        table.ledger thead th.num { text-align: right; }
        table.ledger tbody td { padding: 6px 8px; border-bottom: 1px solid #eef2f1; font-size: 10px; }
        table.ledger tbody tr:nth-child(even) td { background: #f8faf9; }
        td.num { text-align: right; }
        .debit { color: #b3261e; font-weight: bold; }
        .credit { color: #1e6f5c; font-weight: bold; }
        .muted { color: #9ca3af; }
        .src {
            display: inline-block; font-size: 8px; color: #4b5563; border: 1px solid #d1d5db;
            border-radius: 8px; padding: 0 5px; margin-right: 4px;
        }
        .by { color: #9ca3af; font-size: 8px; }

        table.totals { width: 45%; border-collapse: collapse; margin-top: 12px; float: right; }
        table.totals td { padding: 5px 8px; font-size: 11px; }
        table.totals tr.grand td {
            border-top: 2px solid #10493c; font-weight: bold; font-size: 12px; color: #10493c;
        }
        .empty { text-align: center; color: #9ca3af; padding: 24px; font-size: 11px; }
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

    <div class="doc-title">{{ __('Account Statement') }}</div>
    <div class="doc-sub">{{ __('Generated on') }} {{ now()->format('Y-m-d H:i') }}</div>

    <table class="party-table">
        <tr>
            <td style="width: 58%; padding-right: 12px;">
                <div class="party-box">
                    <div class="label">{{ __('Customer') }}</div>
                    <div class="party-name">{{ $customer->name }}</div>
                    @if ($customer->phone)<div class="party-line">{{ $customer->phone }}</div>@endif
                    @if ($customer->address)<div class="party-line">{{ $customer->address }}</div>@endif
                </div>
            </td>
            <td style="width: 42%;">
                @php
                    $bg = $balance > 0 ? '#b3261e' : ($balance < 0 ? '#1e6f5c' : '#4b5563');
                    $cap = $balance > 0 ? __('Balance due') : ($balance < 0 ? __('Advance / credit') : __('Settled'));
                @endphp
                <table style="width:100%; border-collapse:collapse;">
                    <tr>
                        <td bgcolor="{{ $bg }}" style="padding:12px; text-align:center; color:#ffffff; border-radius:6px;">
                            <div style="font-size:19px; font-weight:bold; color:#ffffff;">{{ $money(abs($balance)) }}</div>
                            <div style="font-size:9px; color:#ffffff;">{{ $cap }}</div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>

    @if ($entries->isEmpty())
        <div class="empty">{{ __('No transactions in this period.') }}</div>
    @else
        <table class="ledger">
            <thead>
                <tr>
                    <th style="width: 15%;">{{ __('Date') }}</th>
                    <th style="width: 43%;">{{ __('Description') }}</th>
                    <th class="num" style="width: 14%;">{{ __('Debit') }}</th>
                    <th class="num" style="width: 14%;">{{ __('Credit') }}</th>
                    <th class="num" style="width: 14%;">{{ __('Balance') }}</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($entries as $entry)
                    <tr>
                        <td>{{ \Illuminate\Support\Carbon::parse($entry->transaction_date)->format('Y-m-d') }}</td>
                        <td>
                            {{ $entry->description ?: '—' }}
                            @if ($entry->creator)<div class="by">{{ $entry->creator->name }}</div>@endif
                        </td>
                        <td class="num">
                            @if ($entry->entry_type === 'debit')
                                <span class="debit">{{ number_format((float) $entry->amount, 2) }}</span>
                            @else
                                <span class="muted">—</span>
                            @endif
                        </td>
                        <td class="num">
                            @if ($entry->entry_type === 'credit')
                                <span class="credit">{{ number_format((float) $entry->amount, 2) }}</span>
                            @else
                                <span class="muted">—</span>
                            @endif
                        </td>
                        <td class="num">{{ number_format((float) $entry->running_balance, 2) }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>

        <table class="totals">
            <tr>
                <td>{{ __('Total Debit') }}</td>
                <td class="num debit">{{ $money($totalDebit) }}</td>
            </tr>
            <tr>
                <td>{{ __('Total Credit') }}</td>
                <td class="num credit">{{ $money($totalCredit) }}</td>
            </tr>
            <tr class="grand">
                <td>{{ $balance > 0 ? __('Balance Due') : ($balance < 0 ? __('Advance / credit') : __('Settled')) }}</td>
                <td class="num">{{ $money(abs($balance)) }}</td>
            </tr>
        </table>
    @endif
</body>
</html>
