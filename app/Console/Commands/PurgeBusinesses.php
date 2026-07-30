<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\PermissionRegistrar;

/**
 * Empties the platform of businesses.
 *
 * Every business, every account inside one, and everything those accounts
 * ever recorded — products, stock, customers, suppliers, sales, purchases,
 * payments, expenses, staff, payroll, closings, ledgers, settings and the
 * trail of all of it. What survives is the platform account itself and the
 * roles and permissions the application is built on, so the owner can sign
 * in afterwards and open the first real business.
 *
 * There is no undo. It is deliberately a command rather than anything the
 * application can reach: no screen, no route, and nothing a deploy runs on
 * its own.
 */
class PurgeBusinesses extends Command
{
    protected $signature = 'platform:purge-businesses {--force : Delete without asking, for a non-interactive run}';

    protected $description = 'Delete every business, its accounts and all of its data, leaving only the platform account';

    /**
     * Emptied wholesale, because every row in them belongs to a business.
     * Children are listed with their parents rather than left to cascade,
     * so a table that loses its foreign key one day does not quietly start
     * leaving orphans behind.
     *
     * @var string[]
     */
    private const BUSINESS_TABLES = [
        'sale_payments', 'sale_items', 'sales',
        'purchase_landed_costs', 'purchase_items', 'purchases',
        'payroll_items', 'payroll_runs',
        'period_closing_snapshots', 'period_closings',
        'employee_advances', 'employees',
        'expenses', 'expense_categories',
        'payments', 'ledger_entries', 'cash_accounts',
        'product_stocks', 'stock_movements', 'products', 'categories', 'units', 'warehouses',
        'customers', 'suppliers',
        'business_settings',
    ];

    public function handle(): int
    {
        $platformOwners = $this->platformOwnerIds();

        if ($platformOwners === []) {
            $this->error('No platform account found. Refusing to run: this would delete every account on the system.');

            return self::FAILURE;
        }

        $doomed = User::query()->whereNotIn('id', $platformOwners)->pluck('id');

        $this->line('Platform accounts kept:   '.count($platformOwners));
        $this->line('Accounts to delete:       '.$doomed->count());
        $this->line('Businesses to delete:     '.DB::table('tenants')->count());
        $this->line('Sales to delete:          '.DB::table('sales')->count());
        $this->line('Products to delete:       '.DB::table('products')->count());

        if (! $this->option('force') && ! $this->confirm('Delete all of it? There is no undo.', false)) {
            $this->info('Nothing was deleted.');

            return self::SUCCESS;
        }

        DB::transaction(function () use ($doomed) {
            // The order below is the safe one anyway; this is here so a
            // circular reference between two business tables cannot stop a
            // purge halfway through and leave the books in pieces.
            Schema::disableForeignKeyConstraints();

            try {
                foreach (self::BUSINESS_TABLES as $table) {
                    DB::table($table)->delete();
                }

                // The trail of a business goes with it. The platform
                // account's own history — who it signed in as, which
                // companies it opened — is not a business's and stays.
                DB::table('activity_log')
                    ->whereNotNull('tenant_id')
                    ->orWhere(fn ($query) => $query
                        ->where('causer_type', User::class)
                        ->whereIn('causer_id', $doomed))
                    ->delete();

                if ($doomed->isNotEmpty()) {
                    // Polymorphic, so nothing cascades these for us.
                    DB::table('model_has_roles')->where('model_type', User::class)->whereIn('model_id', $doomed)->delete();
                    DB::table('model_has_permissions')->where('model_type', User::class)->whereIn('model_id', $doomed)->delete();

                    DB::table('personal_access_tokens')->where('tokenable_type', User::class)->whereIn('tokenable_id', $doomed)->delete();
                    DB::table('idempotency_keys')->whereIn('user_id', $doomed)->delete();

                    // Anyone still holding a signed-in tab is signed out
                    // rather than left with a session pointing at an
                    // account that no longer exists.
                    if (Schema::hasTable('sessions')) {
                        DB::table('sessions')->whereIn('user_id', $doomed)->delete();
                    }

                    // A deleted account may have opened another; the column
                    // is cleared first so nothing points at a missing row.
                    DB::table('users')->whereIn('created_by', $doomed)->update(['created_by' => null]);
                    DB::table('users')->whereIn('id', $doomed)->delete();
                }

                DB::table('tenants')->delete();
            } finally {
                Schema::enableForeignKeyConstraints();
            }
        });

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $this->info('Done. The platform holds '.DB::table('users')->count().' account(s) and no businesses.');

        return self::SUCCESS;
    }

    /**
     * The accounts that run the platform rather than a shop — whoever holds
     * the companies module, by role or directly. Everything else is a
     * business's.
     *
     * @return int[]
     */
    private function platformOwnerIds(): array
    {
        return User::query()
            ->with(['roles.permissions', 'permissions'])
            ->get()
            ->filter(fn (User $user) => $user->isPlatformOwner())
            ->pluck('id')
            ->all();
    }
}
