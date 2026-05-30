import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatUsd } from "@/lib/mock-vendors/payments";
import { actAddBudgetLine } from "@/app/actions/payments";

export default async function BudgetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const study = await prisma.study.findUnique({
    where: { id },
    include: { budgetLines: { orderBy: { createdAt: "asc" } } },
  });
  if (!study) notFound();

  const settled = await prisma.paymentEvent.aggregate({
    where: { rule: { studyId: id }, status: "SETTLED" },
    _sum: { amountCents: true },
  });

  const totalPlanned = study.budgetLines.reduce(
    (a, l) => a + l.plannedCents,
    0,
  );
  const totalActual = settled._sum.amountCents ?? 0;
  const utilization = totalPlanned === 0 ? 0 : (totalActual / totalPlanned) * 100;

  // Heuristic: participant-compensation actuals come from settled payments.
  const compensationLine = study.budgetLines.find((l) =>
    /compensation|participant/i.test(l.category),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/studies/${study.id}`}
          className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          ← {study.code}
        </Link>
        <h1 className="mt-2 font-display text-3xl tracking-tight">Budget</h1>
        <p className="mt-1 text-[13px] text-[var(--color-muted)]">
          Planned vs actual. Actuals on participant-compensation pull from the
          append-only payments ledger; other categories track planned only.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Planned total" cents={totalPlanned} accent="completed" />
        <Stat label="Settled to date" cents={totalActual} accent="pending" />
        <Stat
          label="Utilization"
          customDisplay={`${utilization.toFixed(1)}%`}
          accent={utilization > 90 ? "overdue" : "pending"}
        />
      </div>

      <Card>
        <CardHeader title="Budget lines" hint={`${study.budgetLines.length} line(s).`} />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-left text-[11px] uppercase tracking-[0.15em] text-[var(--color-muted)]">
              <tr className="border-y border-[var(--color-border)]">
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 font-medium text-right">Planned</th>
                <th className="px-5 py-3 font-medium text-right">Actual</th>
                <th className="px-5 py-3 font-medium text-right">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {study.budgetLines.map((l) => {
                const actual = l.id === compensationLine?.id ? totalActual : 0;
                const remaining = l.plannedCents - actual;
                return (
                  <tr key={l.id} className="hover:bg-[var(--color-surface-2)]">
                    <td className="px-5 py-2.5 font-medium">{l.category}</td>
                    <td className="px-5 py-2.5 text-[var(--color-muted)] text-[12px]">
                      {l.description ?? "—"}
                    </td>
                    <td className="px-5 py-2.5 text-right font-display tabular">
                      {formatUsd(l.plannedCents)}
                    </td>
                    <td className="px-5 py-2.5 text-right font-display tabular text-[var(--color-status-pending)]">
                      {formatUsd(actual)}
                    </td>
                    <td
                      className={`px-5 py-2.5 text-right font-display tabular ${
                        remaining < 0
                          ? "text-[var(--color-status-overdue)]"
                          : "text-[var(--color-ink-2)]"
                      }`}
                    >
                      {formatUsd(remaining)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <form
          action={actAddBudgetLine}
          className="grid gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-2)] px-5 py-4 sm:grid-cols-[1fr_1fr_auto_auto]"
        >
          <input type="hidden" name="studyId" value={study.id} />
          <input
            name="category"
            placeholder="Category"
            required
            className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
          />
          <input
            name="description"
            placeholder="Description (optional)"
            className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
          />
          <input
            name="amountDollars"
            type="number"
            step="0.01"
            min="0"
            placeholder="$"
            required
            className="w-24 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px] tabular"
          />
          <Button type="submit" size="sm">
            Add line
          </Button>
        </form>
      </Card>
    </div>
  );
}

function Stat({
  label,
  cents,
  customDisplay,
  accent,
}: {
  label: string;
  cents?: number;
  customDisplay?: string;
  accent: "completed" | "pending" | "overdue";
}) {
  return (
    <div className="ring-subtle rounded-lg bg-[var(--color-surface)] px-5 py-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
        {label}
      </div>
      <div
        className={`mt-1 font-display text-3xl tracking-tight tabular text-[var(--color-status-${accent})]`}
      >
        {customDisplay ?? formatUsd(cents ?? 0)}
      </div>
    </div>
  );
}
