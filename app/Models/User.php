<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Models\Concerns\RecordsActivity;
use App\Support\Permissions;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Contracts\Permission;
use Spatie\Permission\Traits\HasRoles;

#[Fillable(['name', 'email', 'phone', 'address', 'logo_path', 'locale', 'is_active', 'access_expires_at', 'tenant_id', 'created_by', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    // The permission check is wrapped rather than replaced — see
    // hasPermissionTo() below, which asks the original once the platform
    // account's confinement has had its say.
    use HasRoles {
        hasPermissionTo as heldPermissionTo;
    }
    use RecordsActivity;

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
     *
     * Read from the permission rows directly rather than through can():
     * every permission check consults this to decide what the platform
     * account may do, and asking it back would be a loop.
     */
    public function isPlatformOwner(): bool
    {
        return $this->getAllPermissions()
            ->contains('name', Permissions::of(Permissions::COMPANIES, Permissions::VIEW));
    }

    /**
     * Every permission check in the application arrives here — the gate,
     * the policies, the form requests, the middleware and the blade
     * helpers alike all end up asking this one question.
     *
     * Which makes it the place to hold the platform account to its remit.
     * It runs businesses and the accounts inside them; it sells nothing and
     * banks nothing. A shop's permission that has found its way onto it —
     * ticked by hand on the permission screen, left behind by an older
     * version of this application, or set straight in the database — is
     * refused here rather than honoured, so no row in a table can put the
     * platform account on somebody's till.
     *
     * @param  string|int|Permission|\BackedEnum  $permission
     */
    public function hasPermissionTo($permission, ?string $guardName = null): bool
    {
        $name = match (true) {
            is_string($permission) => $permission,
            $permission instanceof Permission => $permission->name,
            default => null,
        };

        if ($name !== null && ! Permissions::belongsToPlatformOwner($name) && $this->isPlatformOwner()) {
            return false;
        }

        return $this->heldPermissionTo($permission, $guardName);
    }

    /**
     * What this account can actually do, once the platform account's
     * confinement is applied. The navigation and every guard on the
     * frontend are driven from this, so a shop's screen cannot appear in
     * the platform account's menu on the strength of a permission the
     * server would refuse anyway.
     *
     * @return string[]
     */
    public function effectivePermissions(): array
    {
        $held = $this->getAllPermissions()->pluck('name');

        if ($this->isPlatformOwner()) {
            $held = $held->filter(fn (string $permission) => Permissions::belongsToPlatformOwner($permission));
        }

        return $held->values()->all();
    }

    /** The account that opened this one, if anybody on the platform did. */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(self::class, 'created_by');
    }

    /** The accounts this one has opened. */
    public function createdUsers(): HasMany
    {
        return $this->hasMany(self::class, 'created_by');
    }

    /**
     * Whether this account may administer the given one.
     *
     * The platform owner may administer anybody. A Company Admin's reach
     * stops at the staff they took on themselves — not their business at
     * large — so a second admin in the same business is invisible to them,
     * as is anybody that admin hired.
     */
    public function manages(self $target): bool
    {
        if ($this->isPlatformOwner()) {
            return true;
        }

        if ($this->tenant_id === null || $this->tenant_id !== $target->tenant_id) {
            return false;
        }

        return $target->created_by === $this->id;
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
