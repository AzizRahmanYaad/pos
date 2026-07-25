<?php

namespace App\Http\Requests\Users;

use App\Http\Middleware\SetLocale;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UpdateUserRequest extends FormRequest
{
    use ResolvesAssignableAccess;

    public function authorize(): bool
    {
        $target = $this->route('user');

        return $target instanceof User && $this->user()->can('update', $target);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $actor = $this->user();

        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($this->route('user'))],
            'phone' => ['nullable', 'string', 'max:32'],
            'address' => ['nullable', 'string', 'max:255'],
            'logo' => ['nullable', 'image', 'max:2048'],
            'password' => ['sometimes', 'confirmed', Password::defaults()],
            'locale' => ['sometimes', 'required', Rule::in(SetLocale::SUPPORTED_LOCALES)],
            'is_active' => ['sometimes', 'boolean'],
            'roles' => ['sometimes', 'array', 'min:1'],
            'roles.*' => ['string', Rule::in($this->assignableRoles($actor))],
            'permissions' => ['sometimes', 'array'],
            'permissions.*' => ['string', Rule::in($this->assignablePermissions($actor))],
        ];
    }

    protected function prepareForValidation(): void
    {
        // Moving an account between businesses is not an edit anyone can
        // make through this endpoint.
        $this->request->remove('tenant_id');
        $this->request->remove('max_users');
    }
}
