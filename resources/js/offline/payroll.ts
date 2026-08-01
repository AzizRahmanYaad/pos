import { PENDING_FLAG, temporaryId, type CachedResponse, type OutboxEntry } from '@/offline/db';
import { num } from '@/offline/journal';

/**
 * The payroll run behind a queued create.
 *
 * The form asks for an employee, a date and any bonus or extra deduction.
 * Everything a payroll screen actually prints — the base salary, the
 * advances being cleared, and what the person is finally owed — is worked
 * out by the server from records the device already holds. So the payload
 * alone is a run with no money in it, on a screen that is entirely about
 * money.
 *
 * The arithmetic here mirrors CreatePayrollRunAction, including its rule
 * about advances: an outstanding advance is cleared in full or not at all,
 * because a part-paid advance would have to be split across two runs and
 * the books do not work that way. The server wins the moment the queue
 * drains and the real run comes back.
 */

interface Employee {
    id: number;
    name: string;
    salary_amount: number;
    outstanding_advances: number;
    is_active: boolean;
}

function employeesFrom(caches: CachedResponse[]): Employee[] {
    const prefix = 'GET /api/v1/employees';

    for (const cached of caches) {
        if (!cached.key.startsWith(prefix)) continue;

        const rest = cached.key.slice(prefix.length);

        if (rest !== '' && !rest.startsWith('?') && !rest.startsWith('{')) continue;

        const body = cached.body as { data?: unknown };
        const rows = Array.isArray(body?.data) ? body.data as Record<string, unknown>[] : [];

        if (rows.length) {
            return rows.map((row) => ({
                id: Number(row.id),
                name: typeof row.name === 'string' ? row.name : '',
                salary_amount: num(row.salary_amount),
                outstanding_advances: num(row.outstanding_advances),
                is_active: row.is_active !== false,
            }));
        }
    }

    return [];
}

export function buildQueuedPayrollRun(
    entry: OutboxEntry,
    caches: CachedResponse[],
): Record<string, unknown> | null {
    if (entry.method !== 'POST' || entry.url.split('?')[0] !== '/payroll-runs') return null;

    const payload = (entry.data ?? {}) as Record<string, unknown>;
    const employeeId = typeof payload.employee_id === 'number' ? payload.employee_id : null;

    // Bonuses and extra deductions are entered per person, so they only
    // apply to a run for one employee — exactly as the server has it.
    const bonuses = employeeId === null ? 0 : Math.max(0, num(payload.bonuses));
    const otherDeductions = employeeId === null ? 0 : Math.max(0, num(payload.other_deductions));

    const date = typeof payload.date === 'string' && payload.date !== ''
        ? payload.date
        : new Date(entry.createdAt).toISOString().slice(0, 10);
    const period = new Date(date);

    const staff = employeesFrom(caches);
    const covered = employeeId === null
        ? staff.filter((employee) => employee.is_active)
        : staff.filter((employee) => employee.id === employeeId);

    const items = covered.map((employee) => {
        const base = employee.salary_amount;
        const outstanding = employee.outstanding_advances;
        // Cleared in full or not at all.
        const advancesDeducted = outstanding > 0 && outstanding <= base ? outstanding : 0;

        return {
            id: temporaryId(`${entry.id}:${employee.id}`),
            employee_id: employee.id,
            employee_name: employee.name,
            base_salary: base,
            advances_deducted: advancesDeducted,
            other_deductions: otherDeductions,
            bonuses,
            net_pay: Math.max(0, base + bonuses - advancesDeducted - otherDeductions),
        };
    });

    const named = employeeId === null ? null : covered[0]?.name ?? null;

    return {
        id: temporaryId(entry.id),
        employee_id: employeeId,
        employee_name: named,
        period_month: period.getMonth() + 1,
        period_year: period.getFullYear(),
        period_date: date,
        status: 'draft',
        items,
        total_net_pay: items.reduce((sum, item) => sum + item.net_pay, 0),
        [PENDING_FLAG]: true,
    };
}

/** The temporary id this queued run was given on the payroll list. */
export function payrollRunIdFor(entry: OutboxEntry): number {
    return temporaryId(entry.id);
}

/**
 * A queued run, in the shape its own screen expects — so a payroll made
 * during an outage can be opened, checked and printed, not merely listed.
 */
export function queuedPayrollRunDetail(
    path: string,
    entries: OutboxEntry[],
    caches: CachedResponse[],
): unknown | null {
    const match = path.match(/\/api\/v1\/payroll-runs\/(-?\d+)$/);

    if (!match) return null;

    const wanted = Number(match[1]);

    for (const entry of entries) {
        if (payrollRunIdFor(entry) !== wanted) continue;

        const run = buildQueuedPayrollRun(entry, caches);

        if (run) return { data: run };
    }

    return null;
}
