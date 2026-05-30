import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getRole } from "@/lib/auth/role";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { getSimNow } from "@/lib/sim-clock";

export default async function PortalHome() {
  const role = await getRole();
  if (role.kind !== "PARTICIPANT") redirect("/");

  const [participant, simNow] = await Promise.all([
    prisma.participant.findUnique({
      where: { id: role.participantId },
      include: {
        tasks: {
          // Staff-actioned task kinds aren't shown in the participant
          // portal — they live in admin queues instead.
          where: { template: { kind: { notIn: ["KIT_SHIP"] } } },
          include: { template: { include: { timepoint: true } } },
          orderBy: { dueAt: "asc" },
        },
        consents: true,
        study: true,
      },
    }),
    getSimNow(),
  ]);
  if (!participant) redirect("/");

  // If they haven't consented yet, take them straight to consent
  const needsConsent =
    participant.status !== "ENROLLED" && participant.status !== "COMPLETED";
  if (needsConsent && participant.consents.length === 0) {
    return <ConsentPrompt participantName={participant.name} />;
  }

  const due = participant.tasks.filter((t) =>
    ["DUE", "OVERDUE"].includes(t.status),
  );
  const upcoming = participant.tasks.filter((t) => t.status === "PENDING");
  const done = participant.tasks.filter((t) => t.status === "COMPLETED");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[var(--color-muted)]">
          Hi {participant.name.split(" ")[0]} —
        </p>
        <h1 className="mt-1 font-display text-[32px] leading-[1.1] tracking-tight">
          {due.length === 0
            ? "You're all caught up."
            : due.length === 1
              ? "One thing to do today."
              : `${due.length} things to do today.`}
        </h1>
      </div>

      {due.length > 0 && (
        <section>
          <SectionTitle>Today & overdue</SectionTitle>
          <ul className="mt-3 space-y-2.5">
            {due.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                simNow={simNow}
                emphasis
              />
            ))}
          </ul>
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          <SectionTitle>Coming up</SectionTitle>
          <ul className="mt-3 space-y-2">
            {upcoming.map((t) => (
              <TaskCard key={t.id} task={t} simNow={simNow} />
            ))}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <section>
          <SectionTitle>Completed</SectionTitle>
          <ul className="mt-3 space-y-1.5">
            {done.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] text-[var(--color-muted)]"
              >
                <span className="size-1.5 rounded-full bg-[var(--color-status-completed)]" />
                <span className="line-through">{t.template.name}</span>
                {t.completedAt && (
                  <span className="ml-auto font-mono text-[10.5px]">
                    {t.completedAt.toISOString().slice(0, 10)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
      {children}
    </h2>
  );
}

function TaskCard({
  task,
  simNow,
  emphasis,
}: {
  task: {
    id: string;
    status: string;
    dueAt: Date;
    template: { name: string; description: string | null; kind: string };
  };
  simNow: Date;
  emphasis?: boolean;
}) {
  const isOverdue = task.status === "OVERDUE";
  return (
    <li>
      <Link
        href={`/portal/tasks/${task.id}`}
        className={`relative block rounded-xl px-4 py-4 transition-colors ${
          emphasis
            ? isOverdue
              ? "bg-[var(--color-status-overdue-soft)] ring-1 ring-[var(--color-status-overdue)]/30"
              : "bg-[var(--color-ink)] text-[var(--color-bg)]"
            : "bg-[var(--color-surface)] ring-subtle"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div
              className={`text-[15px] font-medium leading-snug ${
                emphasis && !isOverdue ? "text-[var(--color-bg)]" : ""
              }`}
            >
              {task.template.name}
            </div>
            {task.template.description && (
              <p
                className={`mt-1 text-[12.5px] leading-relaxed ${
                  emphasis && !isOverdue
                    ? "text-[var(--color-bg)]/70"
                    : "text-[var(--color-muted)]"
                }`}
              >
                {task.template.description}
              </p>
            )}
            <div
              className={`mt-2 flex items-center gap-2 text-[11px] ${
                emphasis && !isOverdue
                  ? "text-[var(--color-bg)]/60"
                  : "text-[var(--color-muted)]"
              }`}
            >
              <span className="font-mono">{task.template.kind}</span>
              <span>·</span>
              <span>
                {dueRelative(task.dueAt, simNow)}
              </span>
            </div>
          </div>
          <StatusPill status={task.status} />
        </div>
        <div
          className={`mt-3 inline-flex items-center gap-1 text-[12px] ${
            emphasis && !isOverdue
              ? "text-[var(--color-bg)]"
              : "text-[var(--color-primary)]"
          }`}
        >
          Open <span aria-hidden>→</span>
        </div>
      </Link>
    </li>
  );
}

function dueRelative(dueAt: Date, simNow: Date): string {
  const diffMs = dueAt.getTime() - simNow.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  if (diffDays === -1) return "Was due yesterday";
  if (diffDays > 0) return `Due in ${diffDays} days`;
  return `${Math.abs(diffDays)} days overdue`;
}

function ConsentPrompt({ participantName }: { participantName: string }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[var(--color-muted)]">
          Welcome, {participantName.split(" ")[0]}.
        </p>
        <h1 className="mt-1 font-display text-[32px] leading-[1.1] tracking-tight">
          One thing before<br />
          <span className="serif-italic text-[var(--color-primary)]">we begin</span>
          <span className="serif-italic">.</span>
        </h1>
        <p className="mt-3 text-[14px] text-[var(--color-ink-2)]">
          You're enrolled to the study but haven't signed the informed consent
          yet. The study timeline appears here once you sign — it'll show every
          task on your schedule.
        </p>
      </div>
      <Button href="/portal/consent" size="lg" className="w-full">
        Review &amp; sign consent
      </Button>
      <div className="rounded-lg bg-[var(--color-surface-2)] px-4 py-3 text-[12px] text-[var(--color-muted)]">
        Consent is IRB-approved (version v1.0). Your typed signature is stored
        with a timestamp and audit record. A copy of the signed document is
        always available to download.
      </div>
    </div>
  );
}
