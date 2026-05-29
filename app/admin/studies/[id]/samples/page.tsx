import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { actRecordSampleIntake } from "@/app/actions/kits";

export default async function SamplesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const study = await prisma.study.findUnique({
    where: { id },
    include: { timepoints: { orderBy: { dayOffset: "asc" } } },
  });
  if (!study) notFound();

  const [returnedKits, samples] = await Promise.all([
    prisma.kit.findMany({
      where: {
        lot: { sku: { studyId: id } },
        status: { in: ["RETURN_SHIPPED", "RETURNED"] },
      },
      include: {
        participant: true,
        shipments: { where: { direction: "RETURN" }, orderBy: { createdAt: "desc" }, take: 1 },
        samples: true,
      },
      orderBy: { allocatedAt: "desc" },
    }),
    prisma.sample.findMany({
      where: { participant: { studyId: id } },
      include: { participant: true, kit: true },
      orderBy: { intakeAt: "desc" },
      take: 50,
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
        <h1 className="mt-2 font-display text-3xl tracking-tight">Samples</h1>
        <p className="mt-1 text-[13px] text-[var(--color-muted)]">
          Returned kits awaiting intake. Scan each tube barcode, link to a
          timepoint, and record condition. Intake events are audited per row.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Returned kits — awaiting intake"
          hint={`${returnedKits.length} returned kit(s).`}
        />
        <ul className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
          {returnedKits.length === 0 && (
            <li className="px-5 py-10 text-center text-[13px] text-[var(--color-muted)]">
              No returned kits yet. Simulate <code className="font-mono text-[11.5px]">shipping.return_delivered</code> from the simulator panel.
            </li>
          )}
          {returnedKits.map((k) => {
            const intake = async (formData: FormData) => {
              "use server";
              await actRecordSampleIntake({
                kitId: k.id,
                tubeBarcode: (formData.get("tubeBarcode") as string)?.trim(),
                timepointId: (formData.get("timepointId") as string) || undefined,
                condition: (formData.get("condition") as string) || "GOOD",
                notes: (formData.get("notes") as string) || undefined,
              });
            };
            return (
              <li key={k.id} className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="font-medium text-[14px]">
                      {k.participant?.name ?? "unknown participant"}
                    </div>
                    <div className="text-[12px] text-[var(--color-muted)]">
                      <span className="font-mono">{k.qrToken}</span>
                      {k.shipments[0] && (
                        <>
                          <span className="mx-1.5">·</span>
                          <span className="font-mono">
                            {k.shipments[0].trackingNumber}
                          </span>
                        </>
                      )}
                      <span className="mx-1.5">·</span>
                      {k.samples.length} sample(s) recorded
                    </div>
                  </div>
                </div>
                <form
                  action={intake}
                  className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_1fr_auto]"
                >
                  <input
                    name="tubeBarcode"
                    required
                    placeholder="Tube barcode"
                    className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 font-mono text-[12.5px]"
                  />
                  <select
                    name="timepointId"
                    className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[12.5px]"
                  >
                    <option value="">no timepoint</option>
                    {study.timepoints.map((tp) => (
                      <option key={tp.id} value={tp.id}>
                        {tp.name}
                      </option>
                    ))}
                  </select>
                  <select
                    name="condition"
                    className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[12.5px]"
                  >
                    <option value="GOOD">GOOD</option>
                    <option value="DEGRADED">DEGRADED</option>
                    <option value="LOST">LOST</option>
                    <option value="UNUSABLE">UNUSABLE</option>
                  </select>
                  <input
                    name="notes"
                    placeholder="Notes (optional)"
                    className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[12.5px]"
                  />
                  <Button type="submit" size="sm">
                    Record
                  </Button>
                </form>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <CardHeader
          title="Recent sample intakes"
          hint={`${samples.length} latest record(s).`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-left text-[11px] uppercase tracking-[0.15em] text-[var(--color-muted)]">
              <tr className="border-y border-[var(--color-border)]">
                <th className="px-5 py-3 font-medium">Tube</th>
                <th className="px-5 py-3 font-medium">Participant</th>
                <th className="px-5 py-3 font-medium">Condition</th>
                <th className="px-5 py-3 font-medium">Intake at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {samples.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-10 text-center text-[13px] text-[var(--color-muted)]"
                  >
                    No samples recorded yet.
                  </td>
                </tr>
              )}
              {samples.map((s) => (
                <tr key={s.id} className="hover:bg-[var(--color-surface-2)]">
                  <td className="px-5 py-3 font-mono text-[11.5px]">
                    {s.tubeBarcode}
                  </td>
                  <td className="px-5 py-3">{s.participant.name}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-md bg-[var(--color-surface-2)] px-2 py-1 text-[10.5px] font-mono">
                      {s.condition}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono text-[11.5px] text-[var(--color-muted)]">
                    {s.intakeAt?.toISOString().slice(0, 16).replace("T", " ")}
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
