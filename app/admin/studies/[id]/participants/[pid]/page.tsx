import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { getSimNow } from "@/lib/sim-clock";

export default async function ParticipantDetailPage({
  params,
}: {
  params: Promise<{ id: string; pid: string }>;
}) {
  const { id: studyId, pid } = await params;
  const [participant, simNow] = await Promise.all([
    prisma.participant.findUnique({
      where: { id: pid },
      include: {
        arm: true,
        study: true,
        consents: { orderBy: { signedAt: "desc" } },
        tasks: {
          include: { template: { include: { timepoint: true } } },
          orderBy: { dueAt: "asc" },
        },
      },
    }),
    getSimNow(),
  ]);

  if (!participant || participant.studyId !== studyId) notFound();

  const audit = await prisma.auditEvent.findMany({
    where: {
      OR: [
        { targetType: "Participant", targetId: participant.id },
        {
          targetType: "TaskInstance",
          targetId: { in: participant.tasks.map((t) => t.id) },
        },
        {
          targetType: "ConsentRecord",
          targetId: { in: participant.consents.map((c) => c.id) },
        },
      ],
    },
    orderBy: { ts: "desc" },
    take: 25,
  });

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/admin/studies/${studyId}`}
          className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          ← {participant.study.code}
        </Link>
        <h1 className="mt-2 font-display text-4xl tracking-tight">
          {participant.name}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px]">
          <span className="text-[var(--color-muted)]">{participant.email}</span>
          <span className="text-[var(--color-border-strong)]">·</span>
          <span className="text-[var(--color-muted)]">
            {participant.arm?.name ?? "no arm"}
          </span>
          <span className="text-[var(--color-border-strong)]">·</span>
          <StatusPill status={participant.status} />
          {participant.enrolledAt && (
            <>
              <span className="text-[var(--color-border-strong)]">·</span>
              <span className="text-[var(--color-muted)]">
                enrolled{" "}
                <span className="font-mono">
                  {participant.enrolledAt.toISOString().slice(0, 10)}
                </span>
              </span>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <Card>
          <CardHeader
            title="Task timeline"
            hint="Materialised from the study's SOE on enrollment. Updated by the engine."
          />
          <div className="px-5 pb-5">
            {participant.tasks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-2)] px-5 py-8 text-center text-[13px] text-[var(--color-muted)]">
                No tasks yet. Tasks materialise when the participant signs
                consent.
              </div>
            ) : (
              <ol className="relative space-y-3">
                <span
                  aria-hidden
                  className="absolute left-[15px] top-2 bottom-2 w-px bg-[var(--color-border)]"
                />
                {participant.tasks.map((t) => {
                  const overdue =
                    t.status === "DUE" && t.dueAt.getTime() < simNow.getTime();
                  return (
                    <li
                      key={t.id}
                      className="relative flex gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
                    >
                      <span
                        className={`relative z-10 mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                          t.status === "COMPLETED"
                            ? "bg-[var(--color-status-completed)]"
                            : t.status === "OVERDUE" || overdue
                              ? "bg-[var(--color-status-overdue)]"
                              : t.status === "DUE"
                                ? "bg-[var(--color-status-due)]"
                                : "bg-[var(--color-status-pending-soft)] border border-[var(--color-status-pending)]"
                        }`}
                      />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[14px] font-medium">
                            {t.template.name}
                          </span>
                          <StatusPill status={t.status} />
                          {t.template.timepoint && (
                            <span className="text-[11px] font-mono text-[var(--color-muted)]">
                              Day{" "}
                              {t.template.timepoint.dayOffset >= 0 ? "+" : ""}
                              {t.template.timepoint.dayOffset}
                            </span>
                          )}
                        </div>
                        {t.template.description && (
                          <p className="mt-1 text-[12px] text-[var(--color-muted)]">
                            {t.template.description}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-3 text-[11px] text-[var(--color-muted)]">
                          <span>
                            Due{" "}
                            <span className="font-mono">
                              {t.dueAt.toISOString().slice(0, 10)}
                            </span>
                          </span>
                          {t.completedAt && (
                            <>
                              <span>·</span>
                              <span>
                                Completed{" "}
                                <span className="font-mono">
                                  {t.completedAt.toISOString().slice(0, 10)}
                                </span>
                              </span>
                            </>
                          )}
                          <span>·</span>
                          <span className="font-mono">
                            {t.template.triggerType}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          {participant.consents.length > 0 && (
            <Card>
              <CardHeader title="Consent records" />
              <ul className="space-y-2 px-5 pb-5 text-[12.5px]">
                {participant.consents.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2"
                  >
                    <div className="font-mono text-[11px] text-[var(--color-ink-2)]">
                      {c.version}
                    </div>
                    <div className="text-[12px] text-[var(--color-muted)]">
                      Signed by {c.signatureName} ·{" "}
                      <span className="font-mono">
                        {c.signedAt.toISOString().slice(0, 16).replace("T", " ")}
                      </span>
                    </div>
                    <a
                      href={`/${c.pdfBlobPath}`}
                      target="_blank"
                      className="mt-1 inline-block text-[11px] text-[var(--color-primary)]"
                    >
                      Signed artifact →
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card variant="warm">
            <CardHeader title="Audit trail" hint="All events for this participant" />
            <ul className="space-y-2 px-5 pb-5 text-[12px]">
              {audit.length === 0 && (
                <li className="text-[var(--color-muted)]">No events yet.</li>
              )}
              {audit.map((a) => (
                <li
                  key={a.id}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-[var(--color-ink-2)]">
                      {a.action}
                    </span>
                    <span className="font-mono text-[10.5px] text-[var(--color-muted)]">
                      {a.ts.toISOString().slice(11, 19)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">
                    {a.actorLabel ?? a.actorKind.toLowerCase()}{" "}
                    <span className="mx-1">·</span> {a.targetType}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
