import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  actTriageAe,
  actResolveAe,
  actCloseAe,
} from "@/app/actions/ae";

const STATUS_STYLES: Record<string, string> = {
  REPORTED: "bg-[var(--color-status-overdue-soft)] text-[var(--color-status-overdue)]",
  TRIAGED: "bg-[var(--color-status-pending-soft)] text-[var(--color-status-pending)]",
  RESOLVED: "bg-[var(--color-status-completed-soft)] text-[var(--color-status-completed)]",
  CLOSED: "bg-[var(--color-status-skipped-soft)] text-[var(--color-status-skipped)]",
};

const SEVERITY_STYLES: Record<string, string> = {
  MILD: "bg-[var(--color-surface-2)] text-[var(--color-muted)]",
  MODERATE: "bg-[var(--color-status-pending-soft)] text-[var(--color-status-pending)]",
  SERIOUS: "bg-[var(--color-status-overdue-soft)] text-[var(--color-status-overdue)]",
};

export default async function AePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const study = await prisma.study.findUnique({ where: { id } });
  if (!study) notFound();

  const events = await prisma.adverseEvent.findMany({
    where: { studyId: id },
    include: { participant: true, template: true },
    orderBy: { reportedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <Link
            href={`/admin/studies/${study.id}`}
            className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            ← {study.code}
          </Link>
          <h1 className="mt-2 font-display text-3xl tracking-tight">Adverse events</h1>
          <p className="mt-1 text-[13px] text-[var(--color-muted)]">
            Reported by participants from the portal. SERIOUS severity with
            auto-pause configured will halt the participant&apos;s pending tasks
            until resolution.
          </p>
        </div>
        <Button
          href={`/admin/studies/${study.id}/ae/templates`}
          variant="secondary"
        >
          Templates →
        </Button>
      </div>

      <Card>
        <CardHeader title={`${events.length} event(s)`} />
        <ul className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
          {events.length === 0 && (
            <li className="px-5 py-10 text-center text-[13px] text-[var(--color-muted)]">
              No adverse events reported. Participants can report from{" "}
              <code className="font-mono text-[11.5px]">/portal/ae/new</code>.
            </li>
          )}
          {events.map((e) => {
            const fields = safeParse(e.fields);
            const triage = async () => {
              "use server";
              await actTriageAe(e.id);
            };
            const close = async () => {
              "use server";
              await actCloseAe(e.id);
            };
            return (
              <li key={e.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/studies/${study.id}/participants/${e.participantId}`}
                        className="font-medium hover:text-[var(--color-primary)]"
                      >
                        {e.participant.name}
                      </Link>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider ${
                          SEVERITY_STYLES[e.severity] ?? ""
                        }`}
                      >
                        {e.severity}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider ${
                          STATUS_STYLES[e.status] ?? ""
                        }`}
                      >
                        {e.status}
                      </span>
                      <span className="text-[11px] font-mono text-[var(--color-muted)]">
                        {e.reportedAt.toISOString().slice(0, 10)}
                      </span>
                    </div>
                    {e.summary && (
                      <p className="mt-2 text-[13px] text-[var(--color-ink-2)]">
                        {e.summary}
                      </p>
                    )}
                    {fields && Object.keys(fields).length > 0 && (
                      <dl className="mt-2 grid gap-1 text-[12px] sm:grid-cols-2">
                        {Object.entries(fields).map(([k, v]) => (
                          <div key={k} className="flex gap-1.5">
                            <dt className="font-mono text-[11px] text-[var(--color-muted)]">
                              {k}:
                            </dt>
                            <dd>{String(v)}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {e.resolution && (
                      <p className="mt-2 rounded-md bg-[var(--color-status-completed-soft)] px-3 py-2 text-[12px] text-[var(--color-status-completed)]">
                        Resolution: {e.resolution}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {e.status === "REPORTED" && (
                      <form action={triage}>
                        <Button type="submit" size="sm" variant="secondary">
                          Triage
                        </Button>
                      </form>
                    )}
                    {e.status === "TRIAGED" && (
                      <form
                        action={actResolveAe}
                        className="flex flex-col gap-2 w-72"
                      >
                        <input type="hidden" name="aeId" value={e.id} />
                        <input
                          name="resolution"
                          placeholder="Resolution note"
                          className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-1.5 text-[12px]"
                          required
                        />
                        <Button type="submit" size="sm">
                          Resolve
                        </Button>
                      </form>
                    )}
                    {e.status === "RESOLVED" && (
                      <form action={close}>
                        <Button type="submit" size="sm" variant="ghost">
                          Close
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function safeParse(json: string): Record<string, unknown> | null {
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}
