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
    @include('pdf.partials.styles')
</head>
<body>
    @include('pdf.partials.letterhead', [
        'title' => __('Purchase Invoice'),
        'subtitle' => e($purchase->purchase_number).' &nbsp;•&nbsp; '.\Illuminate\Support\Carbon::parse($purchase->purchase_date)->format('Y-m-d'),
    ])

    <div class="doc-head">
        <div class="col-main">
            <div class="box">
                <div class="label">{{ __('Supplier') }}</div>
                <div class="party-name">{{ $purchase->supplier?->name ?? '—' }}</div>
                @if ($purchase->supplier?->phone)<div class="party-line">{{ $purchase->supplier->phone }}</div>@endif
                @if ($purchase->supplier?->address)<div class="party-line">{{ $purchase->supplier->address }}</div>@endif
                <div class="party-line">{{ __('Warehouse') }}: {{ $purchase->warehouse?->name ?? '—' }}</div>
            </div>
        </div>
        <div class="col-side" style="text-align: right;">
            <span class="status-pill" style="background: {{ $statusBg }};">{{ __(ucfirst($purchase->status)) }}</span>
        </div>
    </div>

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
