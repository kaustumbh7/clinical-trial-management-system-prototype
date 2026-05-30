import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getRole } from "@/lib/auth/role";

const MODALITY_LABEL: Record<string, string> = {
  IN_PERSON: "In person",
  E_VISIT: "E-visit",
  VIDEO: "Video call",
};

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)]",
  COMPLETED:
    "bg-[var(--color-status-completed-soft)] text-[var(--color-status-completed)]",
  CANCELED:
    "bg-[var(--color-status-skipped-soft)] text-[var(--color-status-skipped)]",
  NO_SHOW:
    "bg-[var(--color-status-overdue-soft)] text-[var(--color-status-overdue)]",
};

export default async function ParticipantAppointmentsPage() {
  const role = await getRole();
  if (role.kind !== "PARTICIPANT") redirect("/");

  const appointments = await prisma.appointment.findMany({
    where: { participantId: role.participantId },
    orderBy: { scheduledAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[var(--color-muted)]">Calendar</p>
        <h1 className="mt-1 font-display text-[30px] leading-tight tracking-tight">
          Your visits
        </h1>
      </div>

      <ul className="space-y-2">
        {appointments.length === 0 && (
          <li className="rounded-lg bg-[var(--color-surface-2)] px-4 py-5 text-[13px] text-[var(--color-muted)]">
            No appointments yet.
          </li>
        )}
        {appointments.map((a) => (
          <li
            key={a.id}
            className="rounded-lg bg-[var(--color-surface)] px-4 py-4 ring-subtle"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-display text-lg leading-tight">
                {a.scheduledAt.toLocaleString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider ${
                  STATUS_STYLES[a.status]
                }`}
              >
                {a.status}
              </span>
            </div>
            <div className="mt-1 text-[12px] text-[var(--color-muted)]">
              {MODALITY_LABEL[a.modality] ?? a.modality}
              <span className="mx-1.5">·</span>
              {a.durationMin} min
              {a.staffLabel && (
                <>
                  <span className="mx-1.5">·</span>
                  {a.staffLabel}
                </>
              )}
            </div>
            {a.notes && (
              <p className="mt-2 text-[12px] text-[var(--color-ink-2)]">
                {a.notes}
              </p>
            )}
            {a.status === "SCHEDULED" && (
              <Link
                href={`/api/appointments/${a.id}/ics`}
                className="mt-3 inline-block text-[11px] uppercase tracking-[0.18em] text-[var(--color-primary)]"
              >
                Download .ics →
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
