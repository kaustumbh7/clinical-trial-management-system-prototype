import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  actAddSoeTask,
  actUpdateSoeTask,
  actDeleteSoeTask,
} from "@/app/actions/studies";

const KINDS = [
  "SURVEY",
  "VISIT",
  "CONSENT",
  "KIT_SHIP",
  "KIT_ACTIVATE",
  "SAMPLE_COLLECT",
  "SAMPLE_RETURN",
  "REMINDER",
];

const TRIGGERS = ["TIME", "COMPLETION", "MANUAL", "WEBHOOK"];

export default async function SoeEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const study = await prisma.study.findUnique({
    where: { id },
    include: {
      timepoints: { orderBy: { dayOffset: "asc" } },
      templates: {
        orderBy: { sortOrder: "asc" },
        include: {
          _count: { select: { taskInstances: true } },
          timepoint: true,
        },
      },
    },
  });
  if (!study) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/studies/${study.id}/edit`}
          className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          ← Edit study
        </Link>
        <h1 className="mt-2 font-display text-3xl tracking-tight">
          SOE template editor
        </h1>
        <p className="mt-1 max-w-2xl text-[13px] text-[var(--color-muted)]">
          Add or update tasks. Existing enrollments are pinned to materialised{" "}
          <code className="font-mono">TaskInstance</code> rows — edits and
          deletes only affect future enrollments. Tasks already referenced by a
          materialised instance cannot be deleted (you&apos;ll see a count).
        </p>
      </div>

      <Card>
        <CardHeader title={`${study.templates.length} task(s)`} />
        <ul className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
          {study.templates.map((t) => {
            const del = async () => {
              "use server";
              await actDeleteSoeTask(t.id);
            };
            return (
              <li key={t.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <span className="font-mono text-[11px] text-[var(--color-muted)] mt-1 w-6 text-right">
                    {String(t.sortOrder + 1).padStart(2, "0")}
                  </span>
                  <form action={actUpdateSoeTask} className="flex-1 grid gap-2 sm:grid-cols-[1fr_auto] items-start">
                    <input type="hidden" name="templateId" value={t.id} />
                    <input
                      name="name"
                      defaultValue={t.name}
                      className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-1.5 text-[13px]"
                    />
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="rounded-md bg-[var(--color-surface-2)] px-2 py-0.5 font-mono">
                        {t.kind}
                      </span>
                      <span className="rounded-md bg-[var(--color-primary-soft)] px-2 py-0.5 font-mono text-[var(--color-primary-ink)]">
                        {t.triggerType}
                      </span>
                      {t.timepoint && (
                        <span className="text-[var(--color-muted)]">
                          {t.timepoint.name}
                        </span>
                      )}
                    </div>
                    <textarea
                      name="description"
                      defaultValue={t.description ?? ""}
                      rows={2}
                      placeholder="Description (shown in participant portal)"
                      className="sm:col-span-2 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-1.5 text-[12.5px]"
                    />
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <label className="text-[11px] text-[var(--color-muted)]">
                        Reminder offset (days)
                        <input
                          name="reminderOffsetDays"
                          type="number"
                          defaultValue={t.reminderOffsetDays ?? ""}
                          className="ml-2 w-16 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-1 text-[12.5px] tabular"
                        />
                      </label>
                      <span className="text-[11px] text-[var(--color-muted)]">
                        {t._count.taskInstances} materialised instance(s)
                      </span>
                      <Button type="submit" size="sm" variant="secondary">
                        Save
                      </Button>
                    </div>
                  </form>
                  {t._count.taskInstances === 0 ? (
                    <form action={del}>
                      <Button type="submit" size="sm" variant="ghost">
                        Delete
                      </Button>
                    </form>
                  ) : (
                    <span className="text-[10.5px] text-[var(--color-muted)] mt-2">
                      In use
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card variant="warm">
        <CardHeader title="Add a new task" />
        <form action={actAddSoeTask} className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
          <input type="hidden" name="studyId" value={study.id} />
          <label className="text-[12px] text-[var(--color-muted)] sm:col-span-2">
            Name
            <input
              name="name"
              required
              className="mt-1 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
            />
          </label>
          <label className="text-[12px] text-[var(--color-muted)] sm:col-span-2">
            Description
            <textarea
              name="description"
              rows={2}
              className="mt-1 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[12.5px]"
            />
          </label>
          <label className="text-[12px] text-[var(--color-muted)]">
            Timepoint
            <select
              name="timepointId"
              className="mt-1 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
            >
              <option value="">No timepoint</option>
              {study.timepoints.map((tp) => (
                <option key={tp.id} value={tp.id}>
                  {tp.name} (Day {tp.dayOffset})
                </option>
              ))}
            </select>
          </label>
          <label className="text-[12px] text-[var(--color-muted)]">
            Kind
            <select
              name="kind"
              defaultValue="SURVEY"
              className="mt-1 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
            >
              {KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label className="text-[12px] text-[var(--color-muted)]">
            Trigger
            <select
              name="triggerType"
              defaultValue="TIME"
              className="mt-1 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
            >
              {TRIGGERS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="text-[12px] text-[var(--color-muted)]">
            Depends on (for COMPLETION trigger)
            <select
              name="dependsOnTemplateId"
              className="mt-1 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
            >
              <option value="">None</option>
              {study.templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[12px] text-[var(--color-muted)]">
            Reminder offset (days)
            <input
              name="reminderOffsetDays"
              type="number"
              className="mt-1 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px] tabular"
            />
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm">
              Add task
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
