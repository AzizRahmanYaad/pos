<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * One remembered answer to one write. See the migration for why.
 */
#[Fillable([
    'key', 'user_id', 'tenant_id', 'method', 'path',
    'request_fingerprint', 'response_status', 'response_body',
])]
class IdempotencyKey extends Model
{
    /** A row with no status yet is a request still in flight. */
    public function isComplete(): bool
    {
        return $this->response_status !== null;
    }
}
