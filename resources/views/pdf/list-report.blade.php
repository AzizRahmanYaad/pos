@php
    /** @var \App\Models\BusinessSetting $settings */
    /** @var array $columns */
    /** @var array $rows */
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
        table.data { width: 100%; border-collapse: collapse; margin-top: 14px; }
        table.data thead th { background: #10493c; color: #ffffff; font-size: 10px; padding: 7px 8px; text-align: left; }
        table.data thead th.num { text-align: right; }
        table.data tbody td { padding: 6px 8px; border-bottom: 1px solid #eef2f1; font-size: 10px; }
        table.data tbody tr:nth-child(even) td { background: #f8faf9; }
        td.num { text-align: right; }
        .empty { color: #9ca3af; padding: 14px; text-align: center; font-style: italic; }
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

    <div class="doc-title">{{ $title }}</div>
    <div class="doc-sub">
        @if ($subtitle){{ $subtitle }} &nbsp;•&nbsp; @endif
        {{ __('Generated') }}: {{ now()->format('Y-m-d') }}
    </div>

    <table class="data">
        <thead>
            <tr>
                @foreach ($columns as $col)
                    <th class="{{ ($col['align'] ?? 'left') === 'right' ? 'num' : '' }}"
                        @isset($col['width']) style="width: {{ $col['width'] }};" @endisset>
                        {{ $col['label'] }}
                    </th>
                @endforeach
            </tr>
        </thead>
        <tbody>
            @forelse ($rows as $row)
                <tr>
                    @foreach ($columns as $i => $col)
                        <td class="{{ ($col['align'] ?? 'left') === 'right' ? 'num' : '' }}">{{ $row[$i] ?? '' }}</td>
                    @endforeach
                </tr>
            @empty
                <tr><td colspan="{{ count($columns) }}" class="empty">{{ __('No records') }}</td></tr>
            @endforelse
        </tbody>
    </table>
</body>
</html>
