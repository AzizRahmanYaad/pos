<?php

use Illuminate\Support\Facades\Route;

Route::get('/{any}', function () {
    // The SPA shell must never be cached — it's the only thing that points
    // at the current hashed asset filenames, so a stale cached copy would
    // keep loading an old JS/CSS bundle forever regardless of how many
    // times the tab is refreshed, even after a fresh deploy.
    return response()
        ->view('app')
        ->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        ->header('Pragma', 'no-cache');
})->where('any', '^(?!api).*$');
