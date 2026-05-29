import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const OUTCOME_STYLES: Record<string, string> = {
  QUALIFIED: "text-[var(--color-status-completed)] bg-[var(--color-status-completed-soft)]",
  WAITLIST: "text-[var(--color-status-pending)] bg-[var(--color-status-pending-soft)]",
  DISQUALIFIED: "text-[var(--color-status-overdue)] bg-[var(--color-status-overdue-soft)]",
};

export default async function RecruitmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const study = await prisma.study.findUnique({
    where: { id },
    include: { arms: true },
  });
  if (!study) notFound();

  const [responses, leadParticipants] = await Promise.all([
    prisma.screenerResponse.findMany({
      where: { studyId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.participant.findMany({
      where: { studyId: id, status: { in: ["LEAD", "SCREENED"] } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const byOutcome = {
    QUALIFIED: responses.filter((r) => r.outcome === "QUALIFIED").length,
    WAITLIST: responses.filter((r) => r.outcome === "WAITLIST").length,
    DISQUALIFIED: responses.filter((r) => r.outcome === "DISQUALIFIED").length,
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <Link
            href={`/admin/studies/${study.id}`}
            className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            ← {study.code}
          </Link>
          <h1 className="mt-2 font-display text-3xl tracking-tight">
            Recruitment funnel
          </h1>
          <p className="mt-1 text-[13px] text-[var(--color-muted)]">
            Eligibility screener responses · waitlist promotion · enrollment caps.
          </p>
        </div>
        <Button href={`/screener/${study.id}`} variant="secondary">
          Open public screener →
        </Button>
      </div>

      <Card>
        <CardHeader title="Outcomes" />
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-b-lg bg-[var(--color-border)]">
          {(["QUALIFIED", "WAITLIST", "DISQUALIFIED"] as const).map((k) => (
            <div key={k} className="bg-[var(--color-surface)] px-5 py-5">
              <div className="font-display text-4xl tracking-tight">
                {byOutcome[k]}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.15em] text-[var(--color-muted)]">
                {k}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Screener responses"
            hint={`${responses.length} total`}
          />
          <div className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
            {responses.length === 0 && (
              <div className="px-5 py-10 text-center text-[13px] text-[var(--color-muted)]">
                No screener submissions yet.
              </div>
            )}
            {responses.map((r) => {
              const answers = safeParse(r.answers);
              return (
                <div key={r.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-[14px]">{r.leadName}</div>
                      <div className="text-[12px] text-[var(--color-muted)]">
                        {r.leadEmail}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider ${
                        OUTCOME_STYLES[r.outcome]
                      }`}
                    >
                      {r.outcome}
                    </span>
                  </div>
                  {answers && (
                    <div className="mt-2 grid gap-1 text-[12px] sm:grid-cols-2">
                      {Object.entries(answers).map(([k, v]) => (
                        <div key={k} className="flex gap-1.5">
                          <span className="text-[var(--color-muted)] font-mono text-[11px]">
                            {k}:
                          </span>
                          <span className="text-[var(--color-ink-2)]">
                            {String(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 text-[10.5px] font-mono text-[var(--color-muted)]">
                    {r.createdAt.toISOString()}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card variant="warm">
          <CardHeader
            title="Active leads"
            hint="Qualified but not yet enrolled. They'll appear in their participant portal once they log in."
          />
          <ul className="space-y-2 px-5 pb-5 text-[12.5px]">
            {leadParticipants.length === 0 && (
              <li className="text-[var(--color-muted)]">No active leads.</li>
            )}
            {leadParticipants.map((p) => (
              <li
                key={p.id}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{p.name}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                    {p.status}
                  </span>
                </div>
                <div className="text-[11px] text-[var(--color-muted)]">
                  {p.email}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
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
