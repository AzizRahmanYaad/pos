<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_login_with_correct_credentials(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $user = User::factory()->create(['password' => bcrypt('secret123')]);
        $user->assignRole('cashier');

        $response = $this->withHeader('Referer', config('app.url'))->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'secret123',
        ]);

        $response->assertOk()->assertJsonPath('data.email', $user->email);
        $this->assertAuthenticatedAs($user);
    }

    public function test_login_fails_with_incorrect_password(): void
    {
        $user = User::factory()->create(['password' => bcrypt('secret123')]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'wrong-password',
        ]);

        $response->assertUnprocessable();
        $this->assertGuest();
    }

    public function test_inactive_user_cannot_login(): void
    {
        $user = User::factory()->create([
            'password' => bcrypt('secret123'),
            'is_active' => false,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'secret123',
        ]);

        $response->assertUnprocessable();
        $this->assertGuest();
    }

    public function test_authenticated_user_can_fetch_own_profile(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson('/api/v1/auth/me');

        $response->assertOk()->assertJsonPath('data.id', $user->id);
    }

    public function test_guest_cannot_fetch_profile(): void
    {
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_user_can_logout(): void
    {
        $user = User::factory()->create(['password' => bcrypt('secret123')]);

        $referer = ['Referer' => config('app.url')];

        $loginResponse = $this->withHeaders($referer)->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'secret123',
        ]);

        $cookies = collect($loginResponse->headers->getCookies())
            ->mapWithKeys(fn ($cookie) => [$cookie->getName() => $cookie->getValue()])
            ->all();

        $this->withHeaders([...$referer, 'X-XSRF-TOKEN' => urldecode($cookies['XSRF-TOKEN'])])
            ->withCookies($cookies)
            ->postJson('/api/v1/auth/logout')
            ->assertNoContent();
    }
}
