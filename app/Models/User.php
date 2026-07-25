<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Support\Permissions;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

#[Fillable(['name', 'email', 'phone', 'address', 'logo_path', 'locale', 'is_active', 'access_expires_at', 'tenant_id', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'access_expires_at' => 'datetime',
        ];
    }

    /**
     * Whether this account's paid access period has lapsed. A null expiry
     * means unlimited access (e.g. the superadmin).
     */
    public function hasExpiredAccess(): bool
    {
        return $this->access_expires_at !== null && $this->access_expires_at->isPast();
    }

    /**
     * The business this user belongs to. Null for platform superadmins.
     */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    /**
     * Whether this account administers the platform itself rather than a
     * single business — it owns the company list and their user limits,
     * and is the only account that legitimately has no tenant of its own.
     */
    public function isPlatformOwner(): bool
    {
        return $this->can(Permissions::of(Permissions::COMPANIES, Permissions::VIEW));
    }

    /**
     * Whether this account is allowed to administer the given one. The
     * platform owner may administer anybody; everyone else is confined to
     * their own business, and an account with no business at all is never
     * a valid target for a Company Admin.
     */
    public function managesSameBusinessAs(self $target): bool
    {
        if ($this->isPlatformOwner()) {
            return true;
        }

        return $this->tenant_id !== null && $this->tenant_id === $target->tenant_id;
    }

    /**
     * The permissions this account is allowed to hand out.
     *
     * A Company Admin is capped at what they hold themselves, which is what
     * stops them promoting a cashier past their own reach. The platform
     * owner is the deliberate exception: it provisions accounts for
     * businesses whose day-to-day access it pointedly does not have, so it
     * may grant anything a company is allowed to hold.
     *
     * @return string[]
     */
    public function grantablePermissions(): array
    {
        $own = $this->getAllPermissions()->pluck('name')->all();

        if ($this->isPlatformOwner()) {
            return array_values(array_unique([...Permissions::forCompany(), ...$own]));
        }

        return array_values($own);
    }
}
