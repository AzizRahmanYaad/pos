<?php

namespace Tests\Feature\Employees;

use App\Domain\Employees\Actions\CreatePayrollRunAction;
use App\Domain\Employees\Actions\PayPayrollRunAction;
use App\Domain\Employees\Actions\RecordEmployeeAdvanceAction;
use App\Domain\Employees\Exceptions\PayrollAlreadyProcessedException;
use App\Models\CashAccount;
use App\Models\Employee;
use App\Models\User;
use Database\Seeders\BusinessSettingsSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PayrollTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(BusinessSettingsSeeder::class);
    }

    public function test_advance_debits_employee_and_credits_cash_account(): void
    {
        $employee = Employee::factory()->create(['salary_amount' => 500]);
        $cashAccount = CashAccount::factory()->create(['opening_balance' => 1000]);
        $user = User::factory()->create();

        app(RecordEmployeeAdvanceAction::class)->execute(
            employee: $employee,
            amount: 100,
            cashAccount: $cashAccount,
            reason: 'Emergency',
            createdBy: $user->id,
        );

        $this->assertEquals(100.0, $employee->fresh()->currentBalance());
        $this->assertEquals(900.0, $cashAccount->fresh()->currentBalance());
    }

    public function test_payroll_run_auto_deducts_fully_covered_advance(): void
    {
        $employee = Employee::factory()->create(['salary_amount' => 500]);
        $cashAccount = CashAccount::factory()->create();
        $user = User::factory()->create();

        app(RecordEmployeeAdvanceAction::class)->execute($employee, 150, $cashAccount, 'Advance', $user->id);

        $run = app(CreatePayrollRunAction::class)->execute(7, 2026, $user->id);
        $item = $run->items->first();

        $this->assertEquals(500.0, (float) $item->base_salary);
        $this->assertEquals(150.0, (float) $item->advances_deducted);
        $this->assertEquals(350.0, (float) $item->net_pay);

        $this->assertDatabaseHas('employee_advances', [
            'employee_id' => $employee->id,
            'deducted_in_payroll_item_id' => $item->id,
        ]);
    }

    public function test_payroll_run_leaves_advance_outstanding_if_larger_than_salary(): void
    {
        $employee = Employee::factory()->create(['salary_amount' => 100]);
        $cashAccount = CashAccount::factory()->create();
        $user = User::factory()->create();

        app(RecordEmployeeAdvanceAction::class)->execute($employee, 250, $cashAccount, 'Big advance', $user->id);

        $run = app(CreatePayrollRunAction::class)->execute(7, 2026, $user->id);
        $item = $run->items->first();

        $this->assertEquals(0.0, (float) $item->advances_deducted);
        $this->assertEquals(100.0, (float) $item->net_pay);
        $this->assertEquals(250.0, $employee->outstandingAdvanceTotal());
    }

    public function test_paying_a_payroll_run_credits_employee_advance_and_pays_cash(): void
    {
        $employee = Employee::factory()->create(['salary_amount' => 500]);
        $advanceCashAccount = CashAccount::factory()->create();
        $payrollCashAccount = CashAccount::factory()->create(['opening_balance' => 2000]);
        $user = User::factory()->create();

        app(RecordEmployeeAdvanceAction::class)->execute($employee, 100, $advanceCashAccount, 'Advance', $user->id);
        $run = app(CreatePayrollRunAction::class)->execute(7, 2026, $user->id);

        $paid = app(PayPayrollRunAction::class)->execute($run, $payrollCashAccount, $user->id);

        $this->assertEquals(0.0, $employee->fresh()->currentBalance()); // 100 debit, 100 credit = net 0
        $this->assertEquals(1600.0, $payrollCashAccount->fresh()->currentBalance()); // 2000 - 400 net_pay
        $this->assertEquals('paid', $paid->status);
    }

    public function test_cannot_pay_an_already_paid_run(): void
    {
        $employee = Employee::factory()->create(['salary_amount' => 300]);
        $cashAccount = CashAccount::factory()->create();
        $user = User::factory()->create();

        $run = app(CreatePayrollRunAction::class)->execute(7, 2026, $user->id);
        app(PayPayrollRunAction::class)->execute($run, $cashAccount, $user->id);

        $this->expectException(PayrollAlreadyProcessedException::class);
        app(PayPayrollRunAction::class)->execute($run->fresh(), $cashAccount, $user->id);
    }

    public function test_individual_payroll_run_targets_only_the_chosen_employee(): void
    {
        $chosen = Employee::factory()->create(['salary_amount' => 500]);
        Employee::factory()->create(['salary_amount' => 900]);
        $user = User::factory()->create();

        $run = app(CreatePayrollRunAction::class)->execute(7, 2026, $user->id, $chosen->id, '2026-07-15');

        $this->assertEquals($chosen->id, $run->employee_id);
        $this->assertCount(1, $run->items);
        $this->assertEquals($chosen->id, $run->items->first()->employee_id);
        $this->assertEquals('2026-07-15', $run->period_date->toDateString());
    }

    public function test_individual_payroll_applies_bonuses_and_deductions_at_execution(): void
    {
        $employee = Employee::factory()->create(['salary_amount' => 500]);
        $cashAccount = CashAccount::factory()->create();
        $user = User::factory()->create();

        app(RecordEmployeeAdvanceAction::class)->execute($employee, 100, $cashAccount, 'Advance', $user->id);

        $run = app(CreatePayrollRunAction::class)->execute(7, 2026, $user->id, $employee->id, '2026-07-15', 80, 30);
        $item = $run->items->first();

        // 500 base + 80 bonus - 100 advance - 30 deduction = 450
        $this->assertEquals(80.0, (float) $item->bonuses);
        $this->assertEquals(30.0, (float) $item->other_deductions);
        $this->assertEquals(100.0, (float) $item->advances_deducted);
        $this->assertEquals(450.0, (float) $item->net_pay);
    }

    public function test_cannot_run_individual_payroll_twice_for_same_employee_and_period(): void
    {
        $employee = Employee::factory()->create(['salary_amount' => 500]);
        $user = User::factory()->create();

        app(CreatePayrollRunAction::class)->execute(7, 2026, $user->id, $employee->id, '2026-07-15');

        $this->expectException(PayrollAlreadyProcessedException::class);
        app(CreatePayrollRunAction::class)->execute(7, 2026, $user->id, $employee->id, '2026-07-20');
    }

    public function test_manager_can_create_and_pay_payroll_via_api(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $manager->assignRole('manager');

        $employee = Employee::factory()->create(['salary_amount' => 400]);
        $cashAccount = CashAccount::factory()->create(['opening_balance' => 1000]);

        $createResponse = $this->actingAs($manager)->postJson('/api/v1/payroll-runs', [
            'employee_id' => $employee->id,
            'date' => '2026-08-15',
        ]);
        $createResponse->assertCreated();
        $createResponse->assertJsonPath('data.employee_name', $employee->name);
        $runId = $createResponse->json('data.id');

        $this->actingAs($manager)
            ->postJson("/api/v1/payroll-runs/{$runId}/pay", ['cash_account_id' => $cashAccount->id])
            ->assertOk()
            ->assertJsonPath('data.status', 'paid');
    }

    public function test_cashier_cannot_create_payroll_run(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $cashier = User::factory()->create();
        $cashier->assignRole('cashier');
        $employee = Employee::factory()->create();

        $this->actingAs($cashier)->postJson('/api/v1/payroll-runs', [
            'employee_id' => $employee->id,
            'date' => '2026-08-15',
        ])->assertForbidden();
    }
}
