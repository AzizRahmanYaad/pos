<?php

namespace App\Support;

use Illuminate\Support\Carbon;

/**
 * Converts Gregorian dates to the Hijri Shamsi (Solar Hijri / Jalali)
 * calendar used across Afghanistan, and formats them with the Afghan month
 * names. Mirrors the frontend `jalaali-js` output so PDFs and the UI agree.
 */
class JalaliDate
{
    /** Afghan Solar Hijri month names, index 0 = month 1 (Hamal). */
    public const MONTHS = [
        'حمل', 'ثور', 'جوزا', 'سرطان', 'اسد', 'سنبله',
        'میزان', 'عقرب', 'قوس', 'جدی', 'دلو', 'حوت',
    ];

    /**
     * @return array{0:int,1:int,2:int}  [jy, jm, jd]
     */
    public static function fromGregorian(int $gy, int $gm, int $gd): array
    {
        $gDayInMonth = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

        $gy2 = $gm > 2 ? $gy + 1 : $gy;
        $days = 355666 + (365 * $gy) + intdiv($gy2 + 3, 4) - intdiv($gy2 + 99, 100)
            + intdiv($gy2 + 399, 400) + $gd + $gDayInMonth[$gm - 1];

        $jy = -1595 + (33 * intdiv($days, 12053));
        $days %= 12053;

        $jy += 4 * intdiv($days, 1461);
        $days %= 1461;

        if ($days > 365) {
            $jy += intdiv($days - 1, 365);
            $days = ($days - 1) % 365;
        }

        if ($days < 186) {
            $jm = 1 + intdiv($days, 31);
            $jd = 1 + ($days % 31);
        } else {
            $jm = 7 + intdiv($days - 186, 30);
            $jd = 1 + (($days - 186) % 30);
        }

        return [$jy, $jm, $jd];
    }

    /**
     * "19 سنبله 1405"
     */
    public static function format(Carbon|string $date): string
    {
        $carbon = $date instanceof Carbon ? $date : Carbon::parse($date);
        [$jy, $jm, $jd] = self::fromGregorian((int) $carbon->year, (int) $carbon->month, (int) $carbon->day);

        return $jd.' '.(self::MONTHS[$jm - 1] ?? $jm).' '.$jy;
    }

    /**
     * "سنبله 1405" — month name alongside the year, no day.
     */
    public static function monthYear(Carbon|string $date): string
    {
        $carbon = $date instanceof Carbon ? $date : Carbon::parse($date);
        [$jy, $jm] = self::fromGregorian((int) $carbon->year, (int) $carbon->month, (int) $carbon->day);

        return (self::MONTHS[$jm - 1] ?? $jm).' '.$jy;
    }
}
