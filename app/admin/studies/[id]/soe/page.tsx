import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui/Card";

export default async function StudySoePage({
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
        include: { timepoint: true },
      },
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
          Schedule of Events
        </h1>
        <p className="mt-1 text-[13px] text-[var(--color-muted)]">
          The deterministic spine of the study. Templates here become live{" "}
          <span className="font-mono">TaskInstance</span> rows when a
          participant enrolls.
        </p>
      </div>

      <Card>
        <CardHeader title="Template" hint={`${study.templates.length} tasks`} />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-left text-[11px] uppercase tracking-[0.15em] text-[var(--color-muted)]">
              <tr className="border-y border-[var(--color-border)]">
                <th className="px-5 py-3 font-medium">#</th>
                <th className="px-5 py-3 font-medium">Task</th>
                <th className="px-5 py-3 font-medium">Kind</th>
                <th className="px-5 py-3 font-medium">Timepoint</th>
                <th className="px-5 py-3 font-medium">Trigger</th>
                <th className="px-5 py-3 font-medium">Reminder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {study.templates.map((t, i) => (
                <tr key={t.id} className="hover:bg-[var(--color-surface-2)]">
                  <td className="px-5 py-3 font-mono text-[11px] text-[var(--color-muted)]">
                    {String(i + 1).padStart(2, "0")}
                  </td>
                  <td className="px-5 py-3">
                    <div className="font-medium">{t.name}</div>
                    {t.description && (
                      <div className="mt-0.5 text-[12px] text-[var(--color-muted)]">
                        {t.description}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className="rounded-md bg-[var(--color-surface-2)] px-2 py-1 text-[11px] font-mono">
                      {t.kind}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[12px] text-[var(--color-ink-2)]">
                    {t.timepoint?.name ?? "—"}
                    {t.timepoint && (
                      <span className="ml-1 font-mono text-[11px] text-[var(--color-muted)]">
                        (Day {t.timepoint.dayOffset >= 0 ? "+" : ""}
                        {t.timepoint.dayOffset})
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className="rounded-md bg-[var(--color-primary-soft)] px-2 py-1 text-[11px] font-mono text-[var(--color-primary-ink)]">
                      {t.triggerType}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[12px] text-[var(--color-muted)]">
                    {t.reminderOffsetDays != null
                      ? `+${t.reminderOffsetDays}d after due`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
