@php
    /** @var \App\Models\Sale $sale */
    /** @var \App\Models\BusinessSetting $settings */
    $sym = $settings->currency_symbol ?: '';
    $money = fn ($v) => number_format((float) $v, 2) . ($sym ? ' ' . $sym : '');
    $qty = fn ($v) => rtrim(rtrim(number_format((float) $v, 2), '0'), '.');
    $statusColors = [
        'completed' => '#1e6f5c',
        'partially_refunded' => '#b8901f',
        'refunded' => '#b3261e',
        'cancelled' => '#4b5563',
    ];
    $statusLabels = [
        'completed' => __('Completed'),
        'partially_refunded' => __('Partially refunded'),
        'refunded' => __('Refunded'),
        'cancelled' => __('Cancelled'),
    ];
    $statusBg = $statusColors[$sale->status] ?? '#4b5563';
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
        .party-name { font-size: 13px; font-weight: bold; color: #111827; }
        .party-line { font-size: 10px; color: #4b5563; margin-top: 2px; }
        .status-pill { display: inline-block; color: #fff; font-size: 10px; font-weight: bold;
            padding: 3px 10px; border-radius: 10px; }
        table.items { width: 100%; border-collapse: collapse; margin-top: 16px; }
        table.items thead th { background: #10493c; color: #ffffff; font-size: 10px; padding: 7px 8px; text-align: left; }
        table.items thead th.num { text-align: right; }
        table.items tbody td { padding: 6px 8px; border-bottom: 1px solid #eef2f1; font-size: 10px; }
        table.items tbody tr:nth-child(even) td { background: #f8faf9; }
        td.num { text-align: right; }
        .returned-tag { color: #b3261e; font-size: 9px; }
        table.totals { width: 46%; border-collapse: collapse; margin-top: 12px; float: right; }
        table.totals td { padding: 5px 8px; font-size: 11px; }
        table.totals tr.grand td { border-top: 2px solid #10493c; font-weight: bold; font-size: 13px; color: #10493c; }
        table.payments { width: 50%; border-collapse: collapse; margin-top: 12px; }
        table.payments td { padding: 4px 8px; font-size: 10px; }
        .muted { color: #6b7280; }
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

    <div class="doc-title">{{ __('Sale Invoice') }}</div>
    <div class="doc-sub">{{ $sale->invoice_number }} &nbsp;•&nbsp; {{ \Illuminate\Support\Carbon::parse($sale->sale_date)->format('Y-m-d') }}</div>

    <table class="meta-table">
        <tr>
            <td style="width: 58%; padding-right: 12px;">
                <div class="box">
                    <div class="label">{{ __('Customer') }}</div>
                    <div class="party-name">{{ $sale->customer?->name ?? __('messages.walk_in') }}</div>
                    @if ($sale->customer?->phone)<div class="party-line">{{ $sale->customer->phone }}</div>@endif
                    <div class="party-line">{{ __('Warehouse') }}: {{ $sale->warehouse?->name ?? '—' }}</div>
                    <div class="party-line">{{ __('Cashier') }}: {{ $sale->cashier?->name ?? '—' }}</div>
                </div>
            </td>
            <td style="width: 42%; text-align: right;">
                <span class="status-pill" style="background: {{ $statusBg }};">{{ $statusLabels[$sale->status] ?? ucfirst($sale->status) }}</span>
            </td>
        </tr>
    </table>

    <table class="items">
        <thead>
            <tr>
                <th style="width: 38%;">{{ __('Product') }}</th>
                <th class="num" style="width: 14%;">{{ __('Quantity') }}</th>
                <th class="num" style="width: 20%;">{{ __('Sale price') }}</th>
                <th class="num" style="width: 28%;">{{ __('Line total') }}</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($sale->items as $item)
                <tr>
                    <td>
                        {{ $item->product?->name ?? '—' }}
                        @if ((float) $item->refunded_quantity > 0)
                            <div class="returned-tag">{{ __('Returned') }}: {{ $qty($item->refunded_quantity) }}</div>
                        @endif
                    </td>
                    <td class="num">{{ $qty($item->quantity) }}</td>
                    <td class="num">{{ $money($item->unit_price) }}</td>
                    <td class="num">{{ $money($item->line_total) }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <table class="payments">
        @foreach ($sale->payments as $payment)
            <tr>
                <td class="muted">{{ __(ucfirst($payment->method)) }} — {{ $payment->cashAccount?->name ?? '—' }}</td>
                <td class="num">{{ $money($payment->amount) }}</td>
            </tr>
        @endforeach
    </table>

    <table class="totals">
        <tr>
            <td class="muted">{{ __('Subtotal') }}</td>
            <td class="num">{{ $money($sale->subtotal) }}</td>
        </tr>
        @if ((float) $sale->discount > 0)
            <tr><td class="muted">{{ __('Discount') }}</td><td class="num">−{{ $money($sale->discount) }}</td></tr>
        @endif
        @if ((float) $sale->tax > 0)
            <tr><td class="muted">{{ __('Tax') }}</td><td class="num">{{ $money($sale->tax) }}</td></tr>
        @endif
        <tr class="grand">
            <td>{{ __('Grand Total') }}</td>
            <td class="num">{{ $money($sale->grand_total) }}</td>
        </tr>
        <tr>
            <td class="muted">{{ __('Paid') }}</td>
            <td class="num">{{ $money($sale->paid_amount) }}</td>
        </tr>
        @if ((float) $sale->due_amount > 0.005)
            <tr><td class="muted">{{ __('Due') }}</td><td class="num">{{ $money($sale->due_amount) }}</td></tr>
        @endif
    </table>
</body>
</html>
