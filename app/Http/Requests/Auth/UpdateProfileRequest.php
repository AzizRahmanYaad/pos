<?php

namespace App\Http\Requests\Auth;

use App\Http\Middleware\SetLocale;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Editing your own account details. Anyone signed in may do this — it is
 * their own name and photo — so it deliberately carries no permission
 * check. Roles, permissions, active status and expiry are all absent:
 * those are somebody else's to decide, and are handled by UserController.
 */
class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($this->user()->id)],
            'phone' => ['nullable', 'string', 'max:32'],
            'address' => ['nullable', 'string', 'max:255'],
            'logo' => ['nullable', 'image', 'max:2048'],
            'locale' => ['sometimes', 'required', Rule::in(SetLocale::SUPPORTED_LOCALES)],
        ];
    }
}
