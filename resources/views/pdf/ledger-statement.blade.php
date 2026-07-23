@php
    /** @var \Illuminate\Database\Eloquent\Model $party */
    /** @var \Illuminate\Support\Collection $entries */
    /** @var \App\Models\BusinessSetting $settings */
    /** @var string $kind  customer|supplier|cash_account */
    /** @var float $owedToShop  positive = party owes the shop (or cash on hand, for a cash account) */
    $sym = $settings->currency_symbol ?: '';
    $money = fn ($v) => number_format((float) $v, 2) . ($sym ? ' ' . $sym : '');
    $owedToShop = round((float) $owedToShop, 2);
    $partyLabel = match ($kind) {
        'supplier' => __('Supplier'),
        'cash_account' => __('Cash account'),
        default => __('Customer'),
    };
    // For a customer, "owed to shop" is a balance due; for a supplier it is
    // an advance / prepayment. A cash account has no owe/advance polarity —
    // its balance is simply the cash on hand. The reverse sign flips the
    // meaning for customer vs supplier.
    if ($kind === 'cash_account') {
        $bg = $owedToShop < 0 ? '#b3261e' : '#1e6f5c';
        $cap = __('Available balance');
    } elseif ($owedToShop > 0) {
        $bg = $kind === 'supplier' ? '#1e6f5c' : '#b3261e';
        $cap = $kind === 'supplier' ? __('Advance / prepaid') : __('Balance due');
    } elseif ($owedToShop < 0) {
        $bg = $kind === 'supplier' ? '#b3261e' : '#1e6f5c';
        $cap = $kind === 'supplier' ? __('Payable due') : __('Advance / credit');
    } else {
        $bg = '#4b5563';
        $cap = __('Settled');
    }
@endphp
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    @include('pdf.partials.styles')
</head>
<body>
    @include('pdf.partials.letterhead', [
        'title' => __('Account Statement'),
        'subtitle' => __('Generated on').' '.now()->format('Y-m-d H:i'),
    ])

    <div class="doc-head">
        <div class="col-main">
            <div class="box">
                <div class="label">{{ $partyLabel }}</div>
                <div class="party-name">{{ $party->name }}</div>
                @if ($party->phone)<div class="party-line">{{ $party->phone }}</div>@endif
                @if ($party->address)<div class="party-line">{{ $party->address }}</div>@endif
            </div>
        </div>
        <div class="col-side">
            <div class="balance-box" style="background: {{ $bg }};">
                <div class="balance-amt">{{ $money(abs($owedToShop)) }}</div>
                <div class="balance-cap">{{ $cap }}</div>
            </div>
        </div>
    </div>

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
                            @if ($entry->creator)<div class="muted" style="font-size: 8px;">{{ $entry->creator->name }}</div>@endif
                        </td>
                        <td class="num">
                            @if ($entry->entry_type === 'debit')
                                <span class="debit" style="font-weight: bold;">{{ number_format((float) $entry->amount, 2) }}</span>
                            @else
                                <span class="muted">—</span>
                            @endif
                        </td>
                        <td class="num">
                            @if ($entry->entry_type === 'credit')
                                <span class="credit" style="font-weight: bold;">{{ number_format((float) $entry->amount, 2) }}</span>
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
                <td>{{ $cap }}</td>
                <td class="num">{{ $money(abs($owedToShop)) }}</td>
            </tr>
        </table>
    @endif
</body>
</html>
