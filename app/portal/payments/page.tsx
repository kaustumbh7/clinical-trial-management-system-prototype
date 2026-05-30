import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getRole } from "@/lib/auth/role";
import { formatUsd } from "@/lib/mock-vendors/payments";

const STATUS_STYLES: Record<string, string> = {
  PENDING:
    "bg-[var(--color-status-pending-soft)] text-[var(--color-status-pending)]",
  SETTLED:
    "bg-[var(--color-status-completed-soft)] text-[var(--color-status-completed)]",
  FAILED:
    "bg-[var(--color-status-overdue-soft)] text-[var(--color-status-overdue)]",
  VOIDED:
    "bg-[var(--color-status-skipped-soft)] text-[var(--color-status-skipped)]",
};

export default async function ParticipantPaymentsPage() {
  const role = await getRole();
  if (role.kind !== "PARTICIPANT") redirect("/");

  const events = await prisma.paymentEvent.findMany({
    where: { participantId: role.participantId },
    include: { rule: true },
    orderBy: { requestedAt: "desc" },
  });

  const settled = events
    .filter((e) => e.status === "SETTLED")
    .reduce((a, e) => a + e.amountCents, 0);
  const pending = events
    .filter((e) => e.status === "PENDING")
    .reduce((a, e) => a + e.amountCents, 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[var(--color-muted)]">Earnings</p>
        <h1 className="mt-1 font-display text-[30px] leading-tight tracking-tight">
          Your study payments
        </h1>
        <p className="mt-2 text-[13px] text-[var(--color-ink-2)]">
          Earnings appear here as you complete paid tasks. Settlement may take a
          few days to show as paid.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[var(--color-ink)] px-4 py-4 text-[var(--color-bg)]">
          <div className="text-[10px] uppercase tracking-[0.18em] opacity-60">
            Paid
          </div>
          <div className="mt-1 font-display text-3xl tabular">
            {formatUsd(settled)}
          </div>
        </div>
        <div className="rounded-xl bg-[var(--color-surface-2)] px-4 py-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
            Pending
          </div>
          <div className="mt-1 font-display text-3xl tabular text-[var(--color-status-pending)]">
            {formatUsd(pending)}
          </div>
        </div>
      </div>

      <ul className="space-y-2">
        {events.length === 0 && (
          <li className="rounded-lg bg-[var(--color-surface-2)] px-4 py-5 text-[13px] text-[var(--color-muted)]">
            No earnings yet. Complete a paid task to see your first payment
            here.
          </li>
        )}
        {events.map((e) => (
          <li
            key={e.id}
            className="flex items-center justify-between rounded-lg bg-[var(--color-surface)] px-4 py-3 ring-subtle"
          >
            <div>
              <div className="text-[14px] font-medium">{e.rule.name}</div>
              <div className="text-[11px] text-[var(--color-muted)] font-mono">
                {e.requestedAt.toISOString().slice(0, 10)}
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-lg tabular">
                {formatUsd(e.amountCents)}
              </div>
              <span
                className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                  STATUS_STYLES[e.status]
                }`}
              >
                {e.status}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
