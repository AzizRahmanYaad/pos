<?php

namespace Tests\Feature\Users;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserAccessTest extends TestCase
{
    use RefreshDatabase;

    private function superadmin(): User
    {
        $superadmin = User::factory()->create();
        $superadmin->assignRole('superadmin');

        return $superadmin;
    }

    public function test_created_pos_user_gets_one_year_of_access_by_default(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->actingAs($this->superadmin())
            ->postJson('/api/v1/users', [
                'name' => 'Kabul Store',
                'email' => 'store@example.com',
                'phone' => '0700000000',
                'address' => 'Kabul, Afghanistan',
                'password' => 'Secret123!',
                'password_confirmation' => 'Secret123!',
                'locale' => 'en',
                'is_active' => true,
                'roles' => ['admin'],
            ])
            ->assertCreated();

        $user = User::query()->where('email', 'store@example.com')->firstOrFail();

        $this->assertNotNull($user->access_expires_at);
        $this->assertTrue($user->access_expires_at->isSameDay(now()->addYear()));
        $this->assertSame('Kabul, Afghanistan', $user->address);
    }

    public function test_created_superadmin_never_expires(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->actingAs($this->superadmin())
            ->postJson('/api/v1/users', [
                'name' => 'Second Super',
                'email' => 'super2@example.com',
                'password' => 'Secret123!',
                'password_confirmation' => 'Secret123!',
                'locale' => 'en',
                'is_active' => true,
                'roles' => ['superadmin'],
            ])
            ->assertCreated()
            ->assertJsonPath('data.access_expires_at', null);
    }

    public function test_expired_user_cannot_login(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $user = User::factory()->create([
            'password' => 'Secret123!',
            'access_expires_at' => now()->subDay(),
        ]);
        $user->assignRole('admin');

        $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'Secret123!',
        ])
            ->assertForbidden()
            ->assertJsonPath('code', 'access_expired');
    }

    public function test_expired_user_session_is_blocked_from_the_api(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $user = User::factory()->create(['access_expires_at' => now()->subDay()]);
        $user->assignRole('admin');

        $this->actingAs($user)
            ->getJson('/api/v1/products')
            ->assertForbidden()
            ->assertJsonPath('code', 'access_expired');
    }

    public function test_superadmin_can_extend_access_by_one_year(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $expiry = now()->addMonths(2);
        $user = User::factory()->create(['access_expires_at' => $expiry]);
        $user->assignRole('admin');

        $this->actingAs($this->superadmin())
            ->postJson("/api/v1/users/{$user->id}/extend")
            ->assertOk();

        $this->assertTrue(
            $user->fresh()->access_expires_at->isSameDay($expiry->copy()->addYear())
        );
    }

    public function test_extending_an_expired_account_restarts_the_year_from_today(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $user = User::factory()->create(['access_expires_at' => now()->subMonths(3)]);
        $user->assignRole('admin');

        $this->actingAs($this->superadmin())
            ->postJson("/api/v1/users/{$user->id}/extend")
            ->assertOk();

        $this->assertTrue(
            $user->fresh()->access_expires_at->isSameDay(now()->addYear())
        );
    }

    public function test_admin_cannot_extend_access(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $target = User::factory()->create(['access_expires_at' => now()->addMonth()]);
        $target->assignRole('cashier');

        $this->actingAs($admin)
            ->postJson("/api/v1/users/{$target->id}/extend")
            ->assertForbidden();
    }
}
