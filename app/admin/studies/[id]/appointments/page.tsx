import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getSimNow } from "@/lib/sim-clock";
import {
  actCreateAppointment,
  actDuplicateAppointment,
  actCancelAppointment,
  actMarkAppointmentCompleted,
} from "@/app/actions/appointments";

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)]",
  COMPLETED: "bg-[var(--color-status-completed-soft)] text-[var(--color-status-completed)]",
  CANCELED: "bg-[var(--color-status-skipped-soft)] text-[var(--color-status-skipped)]",
  NO_SHOW: "bg-[var(--color-status-overdue-soft)] text-[var(--color-status-overdue)]",
};

const MODALITY_LABEL: Record<string, string> = {
  IN_PERSON: "In-person",
  E_VISIT: "E-visit",
  VIDEO: "Video (telehealth)",
};

export default async function AppointmentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const study = await prisma.study.findUnique({
    where: { id },
    include: {
      participants: {
        where: { status: { in: ["ENROLLED", "COMPLETED"] } },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!study) notFound();

  const [appointments, simNow] = await Promise.all([
    prisma.appointment.findMany({
      where: { studyId: id },
      include: { participant: true },
      orderBy: { scheduledAt: "asc" },
    }),
    getSimNow(),
  ]);

  const defaultScheduledAt = new Date(
    simNow.getTime() + 7 * 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 16);

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
          Appointments &amp; E-visits
        </h1>
        <p className="mt-1 text-[13px] text-[var(--color-muted)]">
          Modality includes in-person, e-visit, and a reserved seat for video
          (telehealth) — added later as a new modality without schema change.
        </p>
      </div>

      <Card variant="warm">
        <CardHeader title="Schedule a new appointment" />
        <form
          action={actCreateAppointment}
          className="grid gap-2 px-5 pb-5 sm:grid-cols-[1fr_1fr_auto_auto_auto]"
        >
          <input type="hidden" name="studyId" value={study.id} />
          <select
            name="participantId"
            required
            className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
          >
            <option value="">Choose participant…</option>
            {study.participants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            name="modality"
            className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
          >
            <option value="E_VISIT">E-visit</option>
            <option value="IN_PERSON">In-person</option>
            <option value="VIDEO" disabled>
              Video (not enabled yet)
            </option>
          </select>
          <input
            name="scheduledAt"
            type="datetime-local"
            required
            defaultValue={defaultScheduledAt}
            className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[12.5px]"
          />
          <input
            name="durationMin"
            type="number"
            min="10"
            step="5"
            defaultValue={30}
            className="w-20 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[12.5px] tabular"
          />
          <Button type="submit" size="sm">
            Schedule
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader title={`${appointments.length} appointment(s)`} />
        <ul className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
          {appointments.length === 0 && (
            <li className="px-5 py-10 text-center text-[13px] text-[var(--color-muted)]">
              No appointments scheduled.
            </li>
          )}
          {appointments.map((a) => {
            const dup = async () => {
              "use server";
              await actDuplicateAppointment(a.id, 7);
            };
            const cancel = async () => {
              "use server";
              await actCancelAppointment(a.id);
            };
            const complete = async () => {
              "use server";
              await actMarkAppointmentCompleted(a.id);
            };
            return (
              <li
                key={a.id}
                className="flex flex-wrap items-center gap-3 px-5 py-3.5"
              >
                <div className="flex-1 min-w-[200px]">
                  <div className="font-medium">
                    {a.participant.name}
                    <span className="ml-2 text-[11px] font-mono text-[var(--color-muted)]">
                      {MODALITY_LABEL[a.modality] ?? a.modality}
                    </span>
                  </div>
                  <div className="text-[12px] text-[var(--color-muted)] font-mono">
                    {a.scheduledAt
                      .toISOString()
                      .slice(0, 16)
                      .replace("T", " ")}
                    <span className="mx-1.5">·</span>
                    {a.durationMin} min
                  </div>
                </div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider ${
                    STATUS_STYLES[a.status] ?? ""
                  }`}
                >
                  {a.status}
                </span>
                {a.status === "SCHEDULED" && (
                  <>
                    <form action={complete}>
                      <Button type="submit" size="sm" variant="secondary">
                        Mark complete
                      </Button>
                    </form>
                    <form action={dup}>
                      <Button type="submit" size="sm" variant="ghost">
                        Duplicate +7d
                      </Button>
                    </form>
                    <form action={cancel}>
                      <Button type="submit" size="sm" variant="ghost">
                        Cancel
                      </Button>
                    </form>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
