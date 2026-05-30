import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatUsd } from "@/lib/mock-vendors/payments";
import {
  actCreatePaymentRule,
  actTogglePaymentRule,
  actVoidPayment,
} from "@/app/actions/payments";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-[var(--color-status-pending-soft)] text-[var(--color-status-pending)]",
  SETTLED: "bg-[var(--color-status-completed-soft)] text-[var(--color-status-completed)]",
  FAILED: "bg-[var(--color-status-overdue-soft)] text-[var(--color-status-overdue)]",
  VOIDED: "bg-[var(--color-status-skipped-soft)] text-[var(--color-status-skipped)]",
};

export default async function PaymentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const study = await prisma.study.findUnique({
    where: { id },
    include: {
      templates: {
        where: { kind: { in: ["SURVEY", "VISIT", "SAMPLE_COLLECT", "SAMPLE_RETURN"] } },
        orderBy: { sortOrder: "asc" },
      },
      paymentRules: {
        include: { _count: { select: { events: true } } },
      },
    },
  });
  if (!study) notFound();

  const events = await prisma.paymentEvent.findMany({
    where: { rule: { studyId: id } },
    include: { participant: true, rule: true },
    orderBy: { requestedAt: "desc" },
    take: 100,
  });

  const totals = events.reduce(
    (acc, e) => {
      if (e.status === "SETTLED") acc.settled += e.amountCents;
      else if (e.status === "PENDING") acc.pending += e.amountCents;
      else if (e.status === "FAILED") acc.failed += e.amountCents;
      return acc;
    },
    { settled: 0, pending: 0, failed: 0 },
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
        <h1 className="mt-2 font-display text-3xl tracking-tight">Payments</h1>
        <p className="mt-1 text-[13px] text-[var(--color-muted)]">
          Rule engine fires charges on task completion. Settlement comes via
          webhook — events stay PENDING until the processor confirms.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Settled" cents={totals.settled} accent="completed" />
        <Stat label="Pending" cents={totals.pending} accent="pending" />
        <Stat label="Failed" cents={totals.failed} accent="overdue" />
      </div>

      <Card>
        <CardHeader title="Payment rules" hint={`${study.paymentRules.length} configured.`} />
        <ul className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)] text-[13px]">
          {study.paymentRules.length === 0 && (
            <li className="px-5 py-8 text-center text-[var(--color-muted)]">
              No payment rules. Add one below.
            </li>
          )}
          {study.paymentRules.map((r) => {
            const toggle = async () => {
              "use server";
              await actTogglePaymentRule(r.id);
            };
            const tpl = study.templates.find((t) => t.id === r.templateId);
            return (
              <li
                key={r.id}
                className="flex items-center gap-4 px-5 py-3"
              >
                <div className="flex-1">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-[12px] text-[var(--color-muted)]">
                    <span className="font-mono">{r.trigger}</span>
                    {tpl && (
                      <>
                        <span className="mx-1.5">·</span>
                        {tpl.name}
                      </>
                    )}
                  </div>
                </div>
                <div className="font-display text-xl tabular text-[var(--color-primary-ink)]">
                  {formatUsd(r.amountCents)}
                </div>
                <div className="text-[11px] text-[var(--color-muted)]">
                  {r._count.events} event(s)
                </div>
                <form action={toggle}>
                  <Button
                    type="submit"
                    size="sm"
                    variant={r.active ? "secondary" : "primary"}
                  >
                    {r.active ? "Active — disable" : "Disabled — enable"}
                  </Button>
                </form>
              </li>
            );
          })}
        </ul>
        <form
          action={actCreatePaymentRule}
          className="grid gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-2)] px-5 py-4 sm:grid-cols-[1fr_1fr_auto_auto]"
        >
          <input type="hidden" name="studyId" value={study.id} />
          <input type="hidden" name="trigger" value="TASK_COMPLETED" />
          <input
            name="name"
            placeholder="Rule name (e.g. Baseline visit completed)"
            required
            className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
          />
          <select
            name="templateId"
            required
            className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
          >
            <option value="">Choose task…</option>
            {study.templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <input
            name="amountDollars"
            type="number"
            step="0.01"
            min="0"
            placeholder="$25"
            required
            className="w-24 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px] tabular"
          />
          <Button type="submit" size="sm">
            Add rule
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Payment events ledger"
          hint={`${events.length} most recent event(s)`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-left text-[11px] uppercase tracking-[0.15em] text-[var(--color-muted)]">
              <tr className="border-y border-[var(--color-border)]">
                <th className="px-5 py-3 font-medium">When</th>
                <th className="px-5 py-3 font-medium">Participant</th>
                <th className="px-5 py-3 font-medium">Rule</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Processor ref</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {events.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-10 text-center text-[var(--color-muted)]"
                  >
                    No payment events yet. Complete a paid task to trigger one.
                  </td>
                </tr>
              )}
              {events.map((e) => {
                const voidPayment = async () => {
                  "use server";
                  await actVoidPayment(e.id);
                };
                return (
                  <tr key={e.id} className="hover:bg-[var(--color-surface-2)]">
                    <td className="px-5 py-2.5 font-mono text-[11px] text-[var(--color-muted)] whitespace-nowrap">
                      {e.requestedAt.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-5 py-2.5">{e.participant.name}</td>
                    <td className="px-5 py-2.5">{e.rule.name}</td>
                    <td className="px-5 py-2.5 font-display tabular">
                      {formatUsd(e.amountCents)}
                    </td>
                    <td className="px-5 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider ${
                          STATUS_STYLES[e.status] ?? ""
                        }`}
                      >
                        {e.status}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 font-mono text-[10.5px] text-[var(--color-muted)]">
                      {e.processorRef}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {e.status === "PENDING" && (
                        <form action={voidPayment}>
                          <Button
                            type="submit"
                            size="sm"
                            variant="ghost"
                          >
                            Void
                          </Button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({
  label,
  cents,
  accent,
}: {
  label: string;
  cents: number;
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
        {formatUsd(cents)}
      </div>
    </div>
  );
}
