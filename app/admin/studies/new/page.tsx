import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { actCreateStudy } from "@/app/actions/studies";

export default function NewStudyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/admin"
          className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          ← Studies
        </Link>
        <h1 className="mt-2 font-display text-3xl tracking-tight">
          New study
        </h1>
        <p className="mt-1 text-[13px] text-[var(--color-muted)]">
          A study starts in DRAFT. You can edit arms, timepoints, and the SOE
          template before flipping it to ACTIVE.
        </p>
      </div>

      <Card>
        <CardHeader title="Study identity" />
        <form action={actCreateStudy} className="grid gap-3 px-5 pb-5">
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
              Display name
            </span>
            <input
              name="name"
              required
              placeholder="e.g. Skin Tolerance Study — Phase III"
              className="mt-1.5 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2.5 text-[14px]"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
              Code (uppercase short slug)
            </span>
            <input
              name="code"
              required
              placeholder="e.g. SKN-25A"
              className="mt-1.5 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2.5 font-mono text-[14px] uppercase"
            />
          </label>
          <Button type="submit" size="lg" className="mt-2">
            Create study
          </Button>
        </form>
      </Card>
    </div>
  );
}
