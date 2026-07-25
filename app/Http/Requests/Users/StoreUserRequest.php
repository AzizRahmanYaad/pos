<?php

namespace App\Http\Requests\Users;

use App\Http\Middleware\SetLocale;
use App\Support\Permissions;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class StoreUserRequest extends FormRequest
{
    use ResolvesAssignableAccess;

    public function authorize(): bool
    {
        return $this->user()->can(Permissions::of(Permissions::USERS, Permissions::CREATE));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $actor = $this->user();
        $isPlatformOwner = $actor->isPlatformOwner();

        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:32'],
            'address' => ['nullable', 'string', 'max:255'],
            'logo' => ['nullable', 'image', 'max:2048'],
            'password' => ['required', 'confirmed', Password::defaults()],
            'locale' => ['required', Rule::in(SetLocale::SUPPORTED_LOCALES)],
            'is_active' => ['boolean'],
            'roles' => ['required', 'array', 'min:1'],
            // Capped at the roles this account may hand out, so a Company
            // Admin cannot mint a platform superadmin.
            'roles.*' => ['string', Rule::in($this->assignableRoles($actor))],
            // Likewise capped at what the actor holds themselves.
            'permissions' => ['sometimes', 'array'],
            'permissions.*' => ['string', Rule::in($this->assignablePermissions($actor))],
            // Only the platform owner picks which business an account
            // joins, or sets a new business's account allowance.
            'tenant_id' => [Rule::excludeIf(! $isPlatformOwner), 'nullable', 'integer', Rule::exists('tenants', 'id')],
            'max_users' => [Rule::excludeIf(! $isPlatformOwner), 'nullable', 'integer', 'min:1'],
        ];
    }

    protected function prepareForValidation(): void
    {
        // A Company Admin's staff always belong to their own business, so
        // drop these rather than silently trusting what the client sent.
        if ($this->user() !== null && ! $this->user()->isPlatformOwner()) {
            $this->request->remove('tenant_id');
            $this->request->remove('max_users');
        }
    }
}
