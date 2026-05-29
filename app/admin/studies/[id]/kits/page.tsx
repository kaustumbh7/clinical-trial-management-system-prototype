import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { actAllocateAndShipKit } from "@/app/actions/kits";

const KIT_STATUS_STYLES: Record<string, string> = {
  ALLOCATED: "bg-[var(--color-status-pending-soft)] text-[var(--color-status-pending)]",
  SHIPPED: "bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)]",
  DELIVERED: "bg-[var(--color-status-completed-soft)] text-[var(--color-status-completed)]",
  ACTIVATED: "bg-[var(--color-status-completed-soft)] text-[var(--color-status-completed)]",
  RETURN_SHIPPED: "bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)]",
  RETURNED: "bg-[var(--color-status-completed-soft)] text-[var(--color-status-completed)]",
  LOST: "bg-[var(--color-status-overdue-soft)] text-[var(--color-status-overdue)]",
};

export default async function KitsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const study = await prisma.study.findUnique({ where: { id } });
  if (!study) notFound();

  const [participantsNeedingKits, kits] = await Promise.all([
    prisma.participant.findMany({
      where: {
        studyId: id,
        status: "ENROLLED",
        tasks: {
          some: {
            status: { in: ["DUE", "PENDING"] },
            template: { kind: "KIT_SHIP" },
          },
        },
        kits: { none: {} },
      },
      orderBy: { enrolledAt: "asc" },
    }),
    prisma.kit.findMany({
      where: {
        lot: { sku: { studyId: id } },
      },
      include: {
        participant: true,
        lot: { include: { sku: true } },
        shipments: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { allocatedAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/studies/${study.id}`}
          className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          ← {study.code}
        </Link>
        <h1 className="mt-2 font-display text-3xl tracking-tight">Kits</h1>
        <p className="mt-1 text-[13px] text-[var(--color-muted)]">
          Allocate a kit from inventory, generate a carrier label, and let the
          engine drive the rest via webhooks.
        </p>
      </div>

      {participantsNeedingKits.length > 0 && (
        <Card variant="warm">
          <CardHeader
            title="Awaiting kit"
            hint={`${participantsNeedingKits.length} enrolled participant(s) need a kit shipped.`}
          />
          <ul className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
            {participantsNeedingKits.map((p) => {
              const allocate = async () => {
                "use server";
                await actAllocateAndShipKit(p.id);
              };
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-3 px-5 py-3"
                >
                  <div className="flex-1">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-[12px] text-[var(--color-muted)]">
                      {p.email}
                    </div>
                  </div>
                  <form action={allocate}>
                    <Button type="submit" size="sm">
                      Allocate &amp; ship
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Kit ledger"
          hint={`${kits.length} kit(s) tracked for this study.`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-left text-[11px] uppercase tracking-[0.15em] text-[var(--color-muted)]">
              <tr className="border-y border-[var(--color-border)]">
                <th className="px-5 py-3 font-medium">Kit · QR</th>
                <th className="px-5 py-3 font-medium">Participant</th>
                <th className="px-5 py-3 font-medium">Lot</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Latest shipment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {kits.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-10 text-center text-[13px] text-[var(--color-muted)]"
                  >
                    No kits allocated yet.
                  </td>
                </tr>
              )}
              {kits.map((k) => {
                const latest = k.shipments[0];
                return (
                  <tr key={k.id} className="hover:bg-[var(--color-surface-2)]">
                    <td className="px-5 py-3">
                      <div className="font-mono text-[11.5px]">{k.qrToken}</div>
                      <div className="text-[10.5px] text-[var(--color-muted)]">
                        allocated{" "}
                        {k.allocatedAt.toISOString().slice(0, 10)}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {k.participant ? (
                        <Link
                          href={`/admin/studies/${id}/participants/${k.participant.id}`}
                          className="hover:text-[var(--color-primary)]"
                        >
                          {k.participant.name}
                        </Link>
                      ) : (
                        <span className="text-[var(--color-muted)]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono text-[11.5px] text-[var(--color-muted)]">
                      {k.lot.lotNumber}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider ${
                          KIT_STATUS_STYLES[k.status] ?? ""
                        }`}
                      >
                        {k.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[12px] text-[var(--color-muted)]">
                      {latest ? (
                        <>
                          <span className="font-mono">{latest.carrier}</span>
                          <span className="mx-1.5">·</span>
                          <span className="font-mono">
                            {latest.trackingNumber}
                          </span>
                          <span className="mx-1.5">·</span>
                          <span className="font-mono uppercase text-[10px]">
                            {latest.status}
                          </span>
                        </>
                      ) : (
                        "—"
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
