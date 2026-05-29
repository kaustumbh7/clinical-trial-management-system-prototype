import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui/Card";

export default async function InventoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const study = await prisma.study.findUnique({
    where: { id },
    include: {
      kitSkus: {
        include: {
          lots: {
            orderBy: { receivedAt: "desc" },
            include: {
              _count: { select: { kits: true } },
            },
          },
        },
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
        <h1 className="mt-2 font-display text-3xl tracking-tight">Inventory</h1>
        <p className="mt-1 text-[13px] text-[var(--color-muted)]">
          Kit SKUs, lots, on-hand counts, and below-threshold alerts. The next
          ship-kit request will pull from the lowest non-empty lot.
        </p>
      </div>

      {study.kitSkus.length === 0 ? (
        <Card>
          <div className="px-5 py-10 text-center text-[13px] text-[var(--color-muted)]">
            No kit SKUs configured for this study.
          </div>
        </Card>
      ) : (
        study.kitSkus.map((sku) => (
          <Card key={sku.id}>
            <CardHeader
              title={
                <span>
                  <span className="font-mono text-[12px] text-[var(--color-muted)] mr-2">
                    {sku.code}
                  </span>
                  {sku.name}
                </span>
              }
              hint={`Vendor ${sku.vendor ?? "—"} · expiry ${sku.expiryMonths} months`}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="text-left text-[11px] uppercase tracking-[0.15em] text-[var(--color-muted)]">
                  <tr className="border-y border-[var(--color-border)]">
                    <th className="px-5 py-3 font-medium">Lot</th>
                    <th className="px-5 py-3 font-medium">On hand</th>
                    <th className="px-5 py-3 font-medium">Threshold</th>
                    <th className="px-5 py-3 font-medium">Allocated kits</th>
                    <th className="px-5 py-3 font-medium">Expiry</th>
                    <th className="px-5 py-3 font-medium">Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {sku.lots.map((lot) => {
                    const low = lot.quantityOnHand < lot.threshold;
                    return (
                      <tr
                        key={lot.id}
                        className="hover:bg-[var(--color-surface-2)]"
                      >
                        <td className="px-5 py-3 font-mono">
                          {lot.lotNumber}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`font-display text-2xl tabular ${
                              low
                                ? "text-[var(--color-status-overdue)]"
                                : "text-[var(--color-ink)]"
                            }`}
                          >
                            {lot.quantityOnHand}
                          </span>
                          {low && (
                            <span className="ml-2 rounded-full bg-[var(--color-status-overdue-soft)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--color-status-overdue)]">
                              Below threshold
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-[var(--color-muted)] font-mono">
                          {lot.threshold}
                        </td>
                        <td className="px-5 py-3 font-mono">{lot._count.kits}</td>
                        <td className="px-5 py-3 text-[var(--color-muted)] font-mono">
                          {lot.expiryAt?.toISOString().slice(0, 10) ?? "—"}
                        </td>
                        <td className="px-5 py-3 text-[var(--color-muted)] font-mono">
                          {lot.receivedAt.toISOString().slice(0, 10)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
