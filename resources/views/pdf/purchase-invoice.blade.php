@php
    /** @var \App\Models\Purchase $purchase */
    /** @var \App\Models\BusinessSetting $settings */
    $sym = $settings->currency_symbol ?: '';
    $money = fn ($v) => number_format((float) $v, 2) . ($sym ? ' ' . $sym : '');
    $statusColors = ['draft' => '#4b5563', 'received' => '#1e6f5c', 'cancelled' => '#b3261e'];
    $statusBg = $statusColors[$purchase->status] ?? '#4b5563';
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
        table.totals { width: 46%; border-collapse: collapse; margin-top: 12px; float: right; }
        table.totals td { padding: 5px 8px; font-size: 11px; }
        table.totals tr.grand td { border-top: 2px solid #10493c; font-weight: bold; font-size: 13px; color: #10493c; }
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

    <div class="doc-title">{{ __('Purchase Invoice') }}</div>
    <div class="doc-sub">{{ $purchase->purchase_number }} &nbsp;•&nbsp; {{ \Illuminate\Support\Carbon::parse($purchase->purchase_date)->format('Y-m-d') }}</div>

    <table class="meta-table">
        <tr>
            <td style="width: 58%; padding-right: 12px;">
                <div class="box">
                    <div class="label">{{ __('Supplier') }}</div>
                    <div class="party-name">{{ $purchase->supplier?->name ?? '—' }}</div>
                    @if ($purchase->supplier?->phone)<div class="party-line">{{ $purchase->supplier->phone }}</div>@endif
                    @if ($purchase->supplier?->address)<div class="party-line">{{ $purchase->supplier->address }}</div>@endif
                    <div class="party-line">{{ __('Warehouse') }}: {{ $purchase->warehouse?->name ?? '—' }}</div>
                </div>
            </td>
            <td style="width: 42%; text-align: right;">
                <span class="status-pill" style="background: {{ $statusBg }};">{{ __(ucfirst($purchase->status)) }}</span>
            </td>
        </tr>
    </table>

    <table class="items">
        <thead>
            <tr>
                <th style="width: 30%;">{{ __('Product') }}</th>
                <th class="num" style="width: 11%;">{{ __('Quantity') }}</th>
                <th class="num" style="width: 15%;">{{ __('Unit cost') }}</th>
                <th class="num" style="width: 15%;">{{ __('Line total') }}</th>
                <th class="num" style="width: 14%;">{{ __('Landed cost') }}</th>
                <th class="num" style="width: 15%;">{{ __('Total cost') }}</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($purchase->items as $item)
                @php
                    $itemQty = (float) $item->quantity;
                    $itemAllocated = (float) $item->allocated_landed_cost;
                    $itemLandedUnitCost = $itemQty > 0 ? (float) $item->unit_cost + ($itemAllocated / $itemQty) : (float) $item->unit_cost;
                @endphp
                <tr>
                    <td>{{ $item->product?->name ?? '—' }}</td>
                    <td class="num">{{ rtrim(rtrim(number_format($itemQty, 2), '0'), '.') }}</td>
                    <td class="num">{{ $money($item->unit_cost) }}</td>
                    <td class="num">{{ $money($item->line_total) }}</td>
                    <td class="num">{{ $money($itemAllocated) }}</td>
                    <td class="num">{{ $money($itemQty * $itemLandedUnitCost) }}</td>
                </tr>
            @endforeach
            @foreach ($purchase->landedCosts as $cost)
                <tr>
                    <td colspan="5">{{ __('Landed cost') }}: {{ $cost->description }}</td>
                    <td class="num">{{ $money($cost->amount) }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <table class="totals">
        <tr>
            <td class="muted">{{ __('Subtotal') }}</td>
            <td class="num">{{ $money($purchase->subtotal) }}</td>
        </tr>
        @if ((float) $purchase->discount > 0)
            <tr><td class="muted">{{ __('Discount') }}</td><td class="num">−{{ $money($purchase->discount) }}</td></tr>
        @endif
        @if ((float) $purchase->tax > 0)
            <tr><td class="muted">{{ __('Tax') }}</td><td class="num">{{ $money($purchase->tax) }}</td></tr>
        @endif
        @if ((float) $purchase->landed_cost_total > 0)
            <tr><td class="muted">{{ __('Landed cost') }}</td><td class="num">{{ $money($purchase->landed_cost_total) }}</td></tr>
        @endif
        <tr class="grand">
            <td>{{ __('Grand Total') }}</td>
            <td class="num">{{ $money($purchase->grand_total) }}</td>
        </tr>
        <tr>
            <td class="muted">{{ __('Paid') }}</td>
            <td class="num">{{ $money($purchase->paid_amount) }}</td>
        </tr>
        @if ((float) $purchase->due_amount > 0.005)
            <tr><td class="muted">{{ __('Due') }}</td><td class="num">{{ $money($purchase->due_amount) }}</td></tr>
        @endif
    </table>
</body>
</html>
