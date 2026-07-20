<?php

namespace App\Http\Requests\Users;

use App\Http\Middleware\SetLocale;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('users.manage');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
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
            'roles.*' => ['string', Rule::exists('roles', 'name')],
        ];
    }
}
