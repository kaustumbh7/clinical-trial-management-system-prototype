import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getRole } from "@/lib/auth/role";
import { Button } from "@/components/ui/Button";
import { actReportAe } from "@/app/actions/ae";

type Field = {
  key: string;
  label: string;
  type: "text" | "select";
  options?: string[];
};

export default async function ReportAePage() {
  const role = await getRole();
  if (role.kind !== "PARTICIPANT") redirect("/");
  const participant = await prisma.participant.findUnique({
    where: { id: role.participantId },
    include: { study: true },
  });
  if (!participant) redirect("/");
  const template = await prisma.aeReportTemplate.findFirst({
    where: { studyId: participant.studyId, active: true },
  });
  if (!template) {
    return (
      <div className="rounded-lg bg-[var(--color-surface-2)] px-4 py-6 text-center text-[13px] text-[var(--color-muted)]">
        No AE template configured for this study.
      </div>
    );
  }
  const fields = (JSON.parse(template.fields) as Field[]) ?? [];

  return (
    <div className="space-y-6">
      <Link
        href="/portal"
        className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        ← Back
      </Link>
      <div>
        <p className="text-[12px] text-[var(--color-muted)]">Report a problem</p>
        <h1 className="mt-1 font-display text-[30px] leading-tight tracking-tight">
          Tell us what&apos;s going on
        </h1>
        <p className="mt-2 text-[13px] text-[var(--color-ink-2)]">
          We&apos;ll halt your study tasks while we look into anything serious.
          A coordinator will follow up within one business day.
        </p>
      </div>

      <form action={actReportAe} className="space-y-5">
        <input type="hidden" name="participantId" value={participant.id} />

        <fieldset>
          <legend className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
            How severe is this?
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {["MILD", "MODERATE", "SERIOUS"].map((s) => (
              <label
                key={s}
                className="cursor-pointer rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2 text-[13px] has-checked:border-[var(--color-status-overdue)] has-checked:bg-[var(--color-status-overdue-soft)] has-checked:text-[var(--color-status-overdue)]"
              >
                <input
                  type="radio"
                  name="severity"
                  value={s}
                  required
                  className="sr-only"
                />
                {s}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
            Summary
          </span>
          <textarea
            name="summary"
            rows={3}
            required
            placeholder="Briefly describe what's happening…"
            className="mt-1.5 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2.5 text-[14px]"
          />
        </label>

        {fields.map((f) => (
          <label key={f.key} className="block">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
              {f.label}
            </span>
            {f.type === "select" && f.options ? (
              <select
                name={`field_${f.key}`}
                className="mt-1.5 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2.5 text-[14px]"
              >
                <option value="">Choose…</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name={`field_${f.key}`}
                className="mt-1.5 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2.5 text-[14px]"
              />
            )}
          </label>
        ))}

        <Button type="submit" size="lg" className="w-full">
          Submit report
        </Button>
      </form>
    </div>
  );
}
