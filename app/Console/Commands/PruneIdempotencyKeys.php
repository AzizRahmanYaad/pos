<?php

namespace App\Console\Commands;

use App\Http\Middleware\EnsureIdempotentWrites;
use App\Models\IdempotencyKey;
use Illuminate\Console\Command;

class PruneIdempotencyKeys extends Command
{
    protected $signature = 'idempotency:prune {--days= : Override the retention window}';

    protected $description = 'Forget remembered answers to writes older than the retention window';

    public function handle(): int
    {
        $days = (int) ($this->option('days') ?: EnsureIdempotentWrites::RETENTION_DAYS);

        $deleted = IdempotencyKey::query()
            ->where('created_at', '<', now()->subDays($days))
            ->delete();

        $this->info("Forgot {$deleted} idempotency key(s) older than {$days} days.");

        return self::SUCCESS;
    }
}
