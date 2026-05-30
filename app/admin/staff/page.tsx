import { prisma } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { actCreateStaffUser } from "@/app/actions/staff";

const ROLE_STYLES: Record<string, string> = {
  PI: "bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)]",
  COORDINATOR:
    "bg-[var(--color-status-pending-soft)] text-[var(--color-status-pending)]",
  OPS: "bg-[var(--color-surface-2)] text-[var(--color-ink-2)]",
  FINANCE: "bg-[var(--color-status-completed-soft)] text-[var(--color-status-completed)]",
  AUDITOR: "bg-[var(--color-status-skipped-soft)] text-[var(--color-status-skipped)]",
  READONLY: "bg-[var(--color-surface-2)] text-[var(--color-muted)]",
};

export default async function StaffPage() {
  const staff = await prisma.staffUser.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { assignments: true, notes: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
          Directory
        </p>
        <h1 className="mt-1 font-display text-3xl tracking-tight">Staff</h1>
        <p className="mt-1 text-[13px] text-[var(--color-muted)]">
          Staff users serve as note authors and assignment targets. In
          production they&apos;d be provisioned via SSO; here we manage them
          directly.
        </p>
      </div>

      <Card>
        <CardHeader title={`${staff.length} staff user(s)`} />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-left text-[11px] uppercase tracking-[0.15em] text-[var(--color-muted)]">
              <tr className="border-y border-[var(--color-border)]">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium text-right">Assigned participants</th>
                <th className="px-5 py-3 font-medium text-right">Notes authored</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {staff.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-10 text-center text-[var(--color-muted)]"
                  >
                    No staff yet. Add one below.
                  </td>
                </tr>
              )}
              {staff.map((s) => (
                <tr key={s.id} className="hover:bg-[var(--color-surface-2)]">
                  <td className="px-5 py-2.5 font-medium">{s.name}</td>
                  <td className="px-5 py-2.5 font-mono text-[12px] text-[var(--color-muted)]">
                    {s.email}
                  </td>
                  <td className="px-5 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider ${
                        ROLE_STYLES[s.role] ?? ""
                      }`}
                    >
                      {s.role}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono tabular">
                    {s._count.assignments}
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono tabular">
                    {s._count.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form
          action={actCreateStaffUser}
          className="grid gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-2)] px-5 py-4 sm:grid-cols-[1fr_1fr_auto_auto]"
        >
          <input
            name="name"
            placeholder="Full name"
            required
            className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
          />
          <input
            name="email"
            type="email"
            placeholder="email@example.com"
            required
            className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
          />
          <select
            name="role"
            defaultValue="COORDINATOR"
            className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
          >
            <option>PI</option>
            <option>COORDINATOR</option>
            <option>OPS</option>
            <option>FINANCE</option>
            <option>AUDITOR</option>
            <option>READONLY</option>
          </select>
          <Button type="submit" size="sm">
            Add staff
          </Button>
        </form>
      </Card>
    </div>
  );
}
