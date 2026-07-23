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
    @include('pdf.partials.styles')
</head>
<body>
    @include('pdf.partials.letterhead', [
        'title' => __('Sale Invoice'),
        'subtitle' => e($sale->invoice_number).' &nbsp;•&nbsp; '.\Illuminate\Support\Carbon::parse($sale->sale_date)->format('Y-m-d'),
    ])

    <div class="doc-head">
        <div class="col-main">
            <div class="box">
                <div class="label">{{ __('Customer') }}</div>
                <div class="party-name">{{ $sale->customer?->name ?? __('messages.walk_in') }}</div>
                @if ($sale->customer?->phone)<div class="party-line">{{ $sale->customer->phone }}</div>@endif
                <div class="party-line">{{ __('Warehouse') }}: {{ $sale->warehouse?->name ?? '—' }}</div>
                <div class="party-line">{{ __('Cashier') }}: {{ $sale->cashier?->name ?? '—' }}</div>
            </div>
        </div>
        <div class="col-side" style="text-align: right;">
            <span class="status-pill" style="background: {{ $statusBg }};">{{ $statusLabels[$sale->status] ?? ucfirst($sale->status) }}</span>
        </div>
    </div>

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

    <table class="payments" style="width: 50%; border-collapse: collapse; margin-top: 12px;">
        @foreach ($sale->payments as $payment)
            <tr>
                <td class="muted" style="padding: 4px 8px; font-size: 10px;">{{ __(ucfirst($payment->method)) }} — {{ $payment->cashAccount?->name ?? '—' }}</td>
                <td class="num" style="padding: 4px 8px; font-size: 10px;">{{ $money($payment->amount) }}</td>
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
