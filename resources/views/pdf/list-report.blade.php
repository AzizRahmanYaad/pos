@php
    /** @var \App\Models\BusinessSetting $settings */
    /** @var array $columns */
    /** @var array $rows */
@endphp
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    @include('pdf.partials.styles')
</head>
<body>
    @include('pdf.partials.letterhead', [
        'title' => $title,
        'subtitle' => ($subtitle ? e($subtitle).' &nbsp;•&nbsp; ' : '').__('Generated').': '.now()->format('Y-m-d'),
    ])

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
