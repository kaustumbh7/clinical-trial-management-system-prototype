import { prisma } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui/Card";

const ACTOR_STYLES: Record<string, string> = {
  STAFF: "bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)]",
  PARTICIPANT: "bg-[var(--color-status-due-soft)] text-[var(--color-status-due)]",
  SYSTEM: "bg-[var(--color-surface-2)] text-[var(--color-muted)]",
};

export default async function AuditPage() {
  const events = await prisma.auditEvent.findMany({
    orderBy: { ts: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
          Append-only
        </p>
        <h1 className="mt-1 font-display text-3xl tracking-tight">Audit log</h1>
        <p className="mt-1 max-w-2xl text-[13px] text-[var(--color-muted)]">
          Every state change in the system is recorded here. In production:
          immutability enforced at the database role layer (no UPDATE/DELETE
          grant), with periodic Merkle anchoring for tamper-evident retention.
        </p>
      </div>

      <Card>
        <CardHeader
          title={`${events.length} most recent events`}
          hint="Newest first."
        />
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="text-left text-[11px] uppercase tracking-[0.15em] text-[var(--color-muted)]">
              <tr className="border-y border-[var(--color-border)]">
                <th className="px-5 py-3 font-medium">When</th>
                <th className="px-5 py-3 font-medium">Action</th>
                <th className="px-5 py-3 font-medium">Actor</th>
                <th className="px-5 py-3 font-medium">Target</th>
                <th className="px-5 py-3 font-medium">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-[var(--color-surface-2)]">
                  <td className="px-5 py-2 font-mono text-[11px] text-[var(--color-muted)] whitespace-nowrap">
                    {e.ts.toISOString().replace("T", " ").slice(0, 19)}
                  </td>
                  <td className="px-5 py-2 font-mono text-[11.5px]">
                    {e.action}
                  </td>
                  <td className="px-5 py-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10.5px] font-mono ${
                        ACTOR_STYLES[e.actorKind] ?? ""
                      }`}
                    >
                      {e.actorLabel ?? e.actorKind.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-5 py-2">
                    <div className="text-[11px] text-[var(--color-ink-2)]">
                      {e.targetType}
                    </div>
                    <div className="font-mono text-[10px] text-[var(--color-muted)]">
                      {e.targetId.slice(0, 12)}…
                    </div>
                  </td>
                  <td className="px-5 py-2 max-w-md">
                    {e.metadata ? (
                      <code className="font-mono text-[10.5px] text-[var(--color-muted)] line-clamp-1">
                        {e.metadata}
                      </code>
                    ) : (
                      <span className="text-[var(--color-muted)]">—</span>
                    )}
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
