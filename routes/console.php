<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('period:close-daily')->dailyAt('23:59');

// The activity log is the fastest-growing table in the system. A year of
// history is kept (config/activitylog.php); anything older is dropped
// overnight rather than being allowed to fill the database.
Schedule::command('activitylog:clean')->weeklyOn(5, '02:30');
Schedule::command('queue:work --stop-when-empty --max-time=50')->everyMinute()->withoutOverlapping();
