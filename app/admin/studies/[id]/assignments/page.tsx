import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { actAssignStaff, actUnassignStaff } from "@/app/actions/staff";

export default async function AssignmentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const study = await prisma.study.findUnique({
    where: { id },
    include: {
      participants: {
        where: { status: { in: ["ENROLLED", "CONSENTED", "COMPLETED"] } },
        include: {
          staffAssignments: { include: { staff: true } },
        },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!study) notFound();

  const staff = await prisma.staffUser.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/studies/${study.id}`}
          className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          ← {study.code}
        </Link>
        <h1 className="mt-2 font-display text-3xl tracking-tight">
          Staff assignments
        </h1>
        <p className="mt-1 text-[13px] text-[var(--color-muted)]">
          Per-participant ownership. The primary coordinator is who gets paged
          on overdue tasks and AE reports.
        </p>
      </div>

      <Card>
        <CardHeader title={`${study.participants.length} active participant(s)`} />
        <ul className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
          {study.participants.map((p) => {
            const primary = p.staffAssignments.find(
              (a) => a.role === "PRIMARY_COORDINATOR",
            );
            const backup = p.staffAssignments.find((a) => a.role === "BACKUP");
            const unassignPrimary = async () => {
              "use server";
              if (primary) await actUnassignStaff(primary.id);
            };
            const unassignBackup = async () => {
              "use server";
              if (backup) await actUnassignStaff(backup.id);
            };
            return (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-3 px-5 py-3.5"
              >
                <div className="flex-1 min-w-[200px]">
                  <Link
                    href={`/admin/studies/${study.id}/participants/${p.id}`}
                    className="font-medium hover:text-[var(--color-primary)]"
                  >
                    {p.name}
                  </Link>
                  <div className="text-[11px] text-[var(--color-muted)]">
                    {p.email}
                  </div>
                </div>
                <div className="flex flex-col gap-1 text-[12px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] w-16">
                      Primary
                    </span>
                    {primary ? (
                      <>
                        <span className="rounded-md bg-[var(--color-primary-soft)] px-2 py-0.5 text-[11.5px]">
                          {primary.staff.name}
                        </span>
                        <form action={unassignPrimary}>
                          <button
                            type="submit"
                            className="text-[10.5px] uppercase tracking-wider text-[var(--color-status-overdue)]"
                          >
                            unassign
                          </button>
                        </form>
                      </>
                    ) : (
                      <span className="text-[var(--color-muted)] italic">
                        none
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] w-16">
                      Backup
                    </span>
                    {backup ? (
                      <>
                        <span className="rounded-md bg-[var(--color-surface-2)] px-2 py-0.5 text-[11.5px]">
                          {backup.staff.name}
                        </span>
                        <form action={unassignBackup}>
                          <button
                            type="submit"
                            className="text-[10.5px] uppercase tracking-wider text-[var(--color-status-overdue)]"
                          >
                            unassign
                          </button>
                        </form>
                      </>
                    ) : (
                      <span className="text-[var(--color-muted)] italic">
                        none
                      </span>
                    )}
                  </div>
                </div>
                <form
                  action={actAssignStaff}
                  className="flex items-center gap-2"
                >
                  <input type="hidden" name="participantId" value={p.id} />
                  <select
                    name="staffId"
                    required
                    className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-1 text-[11.5px]"
                  >
                    <option value="">Pick staff…</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <select
                    name="role"
                    className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-1 text-[11.5px]"
                  >
                    <option value="PRIMARY_COORDINATOR">Primary</option>
                    <option value="BACKUP">Backup</option>
                  </select>
                  <Button type="submit" size="sm" variant="secondary">
                    Assign
                  </Button>
                </form>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
