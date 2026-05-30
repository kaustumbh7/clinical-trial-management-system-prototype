import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { getSimNow } from "@/lib/sim-clock";

export default async function StudyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const study = await prisma.study.findUnique({
    where: { id },
    include: {
      arms: true,
      timepoints: { orderBy: { dayOffset: "asc" } },
      templates: { orderBy: { sortOrder: "asc" } },
      _count: { select: { participants: true, screeners: true } },
    },
  });
  if (!study) notFound();

  const [funnel, participants, recentAudit, simNow] = await Promise.all([
    prisma.participant.groupBy({
      by: ["status"],
      where: { studyId: study.id },
      _count: { _all: true },
    }),
    prisma.participant.findMany({
      where: { studyId: study.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        arm: true,
        tasks: {
          select: { status: true },
        },
      },
    }),
    prisma.auditEvent.findMany({
      where: { studyId: study.id },
      orderBy: { ts: "desc" },
      take: 6,
    }),
    getSimNow(),
  ]);

  const funnelMap = Object.fromEntries(
    funnel.map((f) => [f.status, f._count._all]),
  ) as Record<string, number>;

  const stages: Array<{ key: string; label: string }> = [
    { key: "LEAD", label: "Leads" },
    { key: "SCREENED", label: "Screened" },
    { key: "CONSENTED", label: "Consented" },
    { key: "ENROLLED", label: "Enrolled" },
    { key: "COMPLETED", label: "Completed" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[12px] text-[var(--color-muted)]">
              {study.code}
            </span>
            <span className="rounded-full bg-[var(--color-status-completed-soft)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--color-status-completed)]">
              {study.status}
            </span>
          </div>
          <h1 className="mt-2 font-display text-4xl tracking-tight">
            {study.name}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--color-muted)]">
            {study.arms.length} arms · {study.timepoints.length} timepoints ·{" "}
            {study.templates.length} SOE tasks · created{" "}
            {study.createdAt.toLocaleDateString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            href={`/admin/studies/${study.id}/soe`}
            variant="secondary"
            size="sm"
          >
            SOE template
          </Button>
          <Button
            href={`/admin/studies/${study.id}/recruitment`}
            variant="secondary"
            size="sm"
          >
            Recruitment
          </Button>
          <Button
            href={`/admin/studies/${study.id}/kits`}
            variant="secondary"
            size="sm"
          >
            Kits
          </Button>
          <Button
            href={`/admin/studies/${study.id}/samples`}
            variant="secondary"
            size="sm"
          >
            Samples
          </Button>
          <Button
            href={`/admin/studies/${study.id}/inventory`}
            variant="secondary"
            size="sm"
          >
            Inventory
          </Button>
          <Button
            href={`/admin/studies/${study.id}/payments`}
            variant="secondary"
            size="sm"
          >
            Payments
          </Button>
          <Button
            href={`/admin/studies/${study.id}/budget`}
            variant="secondary"
            size="sm"
          >
            Budget
          </Button>
          <Button
            href={`/admin/studies/${study.id}/ae`}
            variant="secondary"
            size="sm"
          >
            Adverse events
          </Button>
          <Button
            href={`/admin/studies/${study.id}/appointments`}
            variant="secondary"
            size="sm"
          >
            Appointments
          </Button>
          <Button
            href={`/admin/studies/${study.id}/regulatory`}
            variant="secondary"
            size="sm"
          >
            Regulatory
          </Button>
          <Button
            href={`/admin/studies/${study.id}/assignments`}
            variant="secondary"
            size="sm"
          >
            Assignments
          </Button>
          <Button href="/admin/sim" size="sm">
            Simulator →
          </Button>
        </div>
      </div>

      {/* Funnel */}
      <Card>
        <CardHeader
          title="Participant funnel"
          hint="Status counts across the participant lifecycle."
        />
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-b-lg bg-[var(--color-border)] sm:grid-cols-5">
          {stages.map((s) => (
            <div
              key={s.key}
              className="bg-[var(--color-surface)] px-5 py-5"
            >
              <div className="font-display text-4xl tracking-tight">
                {funnelMap[s.key] ?? 0}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.15em] text-[var(--color-muted)]">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Participants */}
        <Card>
          <CardHeader
            title="Recent participants"
            hint={`${study._count.participants} total · ${study._count.screeners} screeners submitted`}
            trailing={
              <Link
                href={`/admin/studies/${study.id}/recruitment`}
                className="text-[12px] text-[var(--color-primary)]"
              >
                View screeners →
              </Link>
            }
          />
          <div className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
            {participants.length === 0 && (
              <div className="px-5 py-10 text-center text-[13px] text-[var(--color-muted)]">
                No participants yet. Open the public{" "}
                <Link
                  href={`/screener/${study.id}`}
                  className="text-[var(--color-primary)]"
                >
                  screener
                </Link>{" "}
                to add one.
              </div>
            )}
            {participants.map((p) => {
              const total = p.tasks.length;
              const completed = p.tasks.filter(
                (t) => t.status === "COMPLETED",
              ).length;
              const due = p.tasks.filter((t) => t.status === "DUE").length;
              const overdue = p.tasks.filter(
                (t) => t.status === "OVERDUE",
              ).length;
              return (
                <Link
                  key={p.id}
                  href={`/admin/studies/${study.id}/participants/${p.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--color-surface-2)]"
                >
                  <div className="flex-1">
                    <div className="font-medium text-[14px]">{p.name}</div>
                    <div className="text-[12px] text-[var(--color-muted)]">
                      {p.email}
                      {p.arm && (
                        <>
                          <span className="mx-1.5">·</span>
                          {p.arm.name}
                        </>
                      )}
                    </div>
                  </div>
                  <StatusPill status={p.status} />
                  {total > 0 && (
                    <div className="hidden sm:flex flex-col items-end text-[11px] text-[var(--color-muted)]">
                      <span className="tabular font-mono">
                        {completed} / {total}
                      </span>
                      <span className="uppercase tracking-wider">
                        tasks complete
                      </span>
                    </div>
                  )}
                  {(overdue > 0 || due > 0) && (
                    <div className="flex flex-col items-end gap-0.5 text-[10px]">
                      {overdue > 0 && (
                        <span className="font-mono tabular text-[var(--color-status-overdue)]">
                          {overdue} overdue
                        </span>
                      )}
                      {due > 0 && (
                        <span className="font-mono tabular text-[var(--color-status-due)]">
                          {due} due
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </Card>

        {/* Audit snippet */}
        <Card variant="warm">
          <CardHeader
            title="Recent activity"
            hint="Append-only audit log — every state change recorded."
            trailing={
              <Link
                href="/admin/audit"
                className="text-[12px] text-[var(--color-primary)]"
              >
                Full log →
              </Link>
            }
          />
          <ul className="space-y-2 px-5 pb-5 text-[12.5px]">
            {recentAudit.length === 0 && (
              <li className="text-[var(--color-muted)]">No activity yet.</li>
            )}
            {recentAudit.map((a) => (
              <li
                key={a.id}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-[var(--color-ink-2)]">
                    {a.action}
                  </span>
                  <span className="text-[11px] text-[var(--color-muted)]">
                    {a.ts.toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">
                  by {a.actorLabel ?? a.actorKind.toLowerCase()}
                  <span className="mx-1.5">·</span>
                  {a.targetType}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Timepoint timeline */}
      <Card>
        <CardHeader
          title="Schedule of Events — timepoints"
          hint="The study's anchor points. Tasks are materialised against these on enrollment."
          trailing={
            <Link
              href={`/admin/studies/${study.id}/soe`}
              className="text-[12px] text-[var(--color-primary)]"
            >
              Full SOE →
            </Link>
          }
        />
        <div className="px-5 pb-5">
          <ol className="grid gap-3 sm:grid-cols-5">
            {study.timepoints.map((tp) => (
              <li
                key={tp.id}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-3"
              >
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
                  Day {tp.dayOffset >= 0 ? `+${tp.dayOffset}` : tp.dayOffset}
                </div>
                <div className="mt-1 text-[13px] font-medium leading-tight">
                  {tp.name}
                </div>
                <div className="mt-2 text-[11px] text-[var(--color-muted)]">
                  {study.templates.filter((t) => t.timepointId === tp.id).length}{" "}
                  tasks
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Card>

      <div className="text-[11px] text-[var(--color-muted)]">
        Sim clock currently at{" "}
        <span className="font-mono">{simNow.toISOString().slice(0, 10)}</span>.
        Advance time from the simulator panel to drive automated transitions.
      </div>
    </div>
  );
}
