<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Organization extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'address',
        'phone',
        'logo_path',
        'admin_user_id',
        'subscription_expires_at',
        'is_active',
    ];

    protected $casts = [
        'subscription_expires_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    public function adminUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_user_id');
    }

    public function isSubscriptionActive(): bool
    {
        return $this->subscription_expires_at > now();
    }

    public function isSubscriptionExpiring(): bool
    {
        return $this->subscription_expires_at->diffInDays(now()) <= 30;
    }

    public function extendSubscription(int $years = 1): void
    {
        $this->subscription_expires_at = $this->subscription_expires_at->addYears($years);
        $this->save();
    }

    public static function createWithAdmin(array $data): self
    {
        $user = User::create([
            'name' => $data['admin_name'],
            'email' => $data['admin_email'],
            'password' => bcrypt($data['admin_password']),
            'locale' => 'en',
        ]);

        $user->assignRole('admin');

        $org = self::create([
            'name' => $data['name'],
            'slug' => \Str::slug($data['name']),
            'address' => $data['address'] ?? null,
            'phone' => $data['phone'] ?? null,
            'logo_path' => $data['logo_path'] ?? null,
            'admin_user_id' => $user->id,
            'subscription_expires_at' => now()->addYear(),
            'is_active' => true,
        ]);

        $user->organization_id = $org->id;
        $user->save();

        return $org;
    }
}
