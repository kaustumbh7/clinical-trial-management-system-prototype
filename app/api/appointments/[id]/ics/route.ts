import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRole } from "@/lib/auth/role";

function toIcsDate(d: Date) {
  // Format: 20260601T150000Z
  return (
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
  );
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const role = await getRole();
  const appt = await prisma.appointment.findUnique({
    where: { id },
    include: { participant: true, study: true },
  });
  if (!appt) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (
    role.kind === "PARTICIPANT" &&
    role.participantId !== appt.participantId
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const start = appt.scheduledAt;
  const end = new Date(start.getTime() + appt.durationMin * 60 * 1000);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//QuidoLabs//CTMS//EN",
    "BEGIN:VEVENT",
    `UID:${appt.id}@quidolabs.ctms`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${appt.study.code} — ${appt.modality.replace("_", " ").toLowerCase()}`,
    appt.notes ? `DESCRIPTION:${appt.notes.replace(/\n/g, "\\n")}` : null,
    `ORGANIZER;CN=${appt.staffLabel ?? "Study coordinator"}:mailto:coordinator@quidolabs.example`,
    `ATTENDEE;CN=${appt.participant.name}:mailto:${appt.participant.email}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="appointment-${appt.id}.ics"`,
    },
  });
}
