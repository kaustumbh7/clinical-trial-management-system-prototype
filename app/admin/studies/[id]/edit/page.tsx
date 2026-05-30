import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  actUpdateStudy,
  actAddArm,
  actAddTimepoint,
  actCloneStudy,
} from "@/app/actions/studies";

export default async function EditStudyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const study = await prisma.study.findUnique({
    where: { id },
    include: {
      arms: { include: { _count: { select: { participants: true } } } },
      timepoints: { orderBy: { dayOffset: "asc" } },
    },
  });
  if (!study) notFound();

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
          Edit study
        </h1>
      </div>

      <Card>
        <CardHeader title="Identity & status" />
        <form action={actUpdateStudy} className="grid gap-3 px-5 pb-5 sm:grid-cols-[1fr_auto_auto]">
          <input type="hidden" name="studyId" value={study.id} />
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
              Name
            </span>
            <input
              name="name"
              defaultValue={study.name}
              required
              className="mt-1 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[14px]"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
              Code
            </span>
            <input
              name="code"
              defaultValue={study.code}
              required
              className="mt-1 w-32 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 font-mono text-[14px] uppercase"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
              Status
            </span>
            <select
              name="status"
              defaultValue={study.status}
              className="mt-1 w-32 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[14px]"
            >
              <option>DRAFT</option>
              <option>ACTIVE</option>
              <option>CLOSED</option>
            </select>
          </label>
          <div className="sm:col-span-3">
            <Button type="submit" size="sm">
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title={`Arms (${study.arms.length})`} />
        <ul className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
          {study.arms.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between px-5 py-3 text-[13px]"
            >
              <div>
                <div className="font-medium">{a.name}</div>
                <div className="text-[11px] text-[var(--color-muted)]">
                  capacity {a.capacity}
                </div>
              </div>
              <div className="text-[11px] text-[var(--color-muted)] font-mono">
                {a._count.participants} participant(s)
              </div>
            </li>
          ))}
        </ul>
        <form
          action={actAddArm}
          className="grid gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-2)] px-5 py-3 sm:grid-cols-[1fr_auto_auto]"
        >
          <input type="hidden" name="studyId" value={study.id} />
          <input
            name="name"
            required
            placeholder="Arm name"
            className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
          />
          <input
            name="capacity"
            type="number"
            min="1"
            defaultValue={50}
            className="w-24 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px] tabular"
          />
          <Button type="submit" size="sm">
            Add arm
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader title={`Timepoints (${study.timepoints.length})`} />
        <ul className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
          {study.timepoints.map((tp) => (
            <li
              key={tp.id}
              className="flex items-center justify-between px-5 py-3 text-[13px]"
            >
              <div>{tp.name}</div>
              <div className="font-mono text-[11.5px] text-[var(--color-muted)]">
                Day {tp.dayOffset >= 0 ? "+" : ""}
                {tp.dayOffset}
              </div>
            </li>
          ))}
        </ul>
        <form
          action={actAddTimepoint}
          className="grid gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-2)] px-5 py-3 sm:grid-cols-[1fr_auto_auto]"
        >
          <input type="hidden" name="studyId" value={study.id} />
          <input
            name="name"
            required
            placeholder="Timepoint name"
            className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
          />
          <input
            name="dayOffset"
            type="number"
            defaultValue={0}
            className="w-24 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px] tabular"
          />
          <Button type="submit" size="sm">
            Add timepoint
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader title="SOE template" />
        <div className="px-5 pb-5">
          <Button href={`/admin/studies/${study.id}/soe/edit`} variant="secondary">
            Edit SOE template →
          </Button>
        </div>
      </Card>

      <Card variant="warm">
        <CardHeader
          title="Clone this study's configuration"
          hint="Copies arms, timepoints, SOE template, payment rules, AE templates, budget lines, and message templates. Never participants or PHI."
        />
        <form
          action={actCloneStudy}
          className="grid gap-2 px-5 pb-5 sm:grid-cols-[1fr_auto_auto]"
        >
          <input type="hidden" name="studyId" value={study.id} />
          <input
            name="newName"
            required
            placeholder="New study name"
            className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
          />
          <input
            name="newCode"
            required
            placeholder="NEW-CODE"
            className="w-32 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 font-mono text-[13px] uppercase"
          />
          <Button type="submit" size="sm">
            Clone
          </Button>
        </form>
      </Card>
    </div>
  );
}
