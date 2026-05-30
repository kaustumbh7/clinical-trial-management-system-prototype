"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { appendAudit } from "@/lib/audit/log";
import { getRole, roleLabel } from "@/lib/auth/role";
import { getSimNow } from "@/lib/sim-clock";

async function requireStaff() {
  const role = await getRole();
  if (role.kind !== "STAFF") throw new Error("Staff only");
  return role;
}

export async function actCreateAppointment(formData: FormData) {
  const role = await requireStaff();
  const studyId = formData.get("studyId") as string;
  const participantId = formData.get("participantId") as string;
  const modality = (formData.get("modality") as string) || "E_VISIT";
  const scheduledAtIso = formData.get("scheduledAt") as string;
  const durationMin = parseInt(
    (formData.get("durationMin") as string) || "30",
    10,
  );
  const notes = (formData.get("notes") as string)?.trim() || null;
  if (!studyId || !participantId || !scheduledAtIso) {
    throw new Error("Study, participant, and time required");
  }
  const appt = await prisma.appointment.create({
    data: {
      studyId,
      participantId,
      modality,
      scheduledAt: new Date(scheduledAtIso),
      durationMin,
      staffLabel: roleLabel(role),
      notes,
    },
  });
  await appendAudit({
    actor: { kind: "STAFF", label: roleLabel(role) },
    action: "APPOINTMENT_SCHEDULED",
    targetType: "Appointment",
    targetId: appt.id,
    studyId,
    metadata: { participantId, modality, scheduledAt: appt.scheduledAt.toISOString() },
  });
  revalidatePath(`/admin/studies/${studyId}/appointments`);
  revalidatePath("/portal", "layout");
}

export async function actDuplicateAppointment(apptId: string, offsetDays: number) {
  const role = await requireStaff();
  const src = await prisma.appointment.findUniqueOrThrow({
    where: { id: apptId },
  });
  const newAt = new Date(
    src.scheduledAt.getTime() + offsetDays * 24 * 60 * 60 * 1000,
  );
  const copy = await prisma.appointment.create({
    data: {
      studyId: src.studyId,
      participantId: src.participantId,
      modality: src.modality,
      scheduledAt: newAt,
      durationMin: src.durationMin,
      staffLabel: roleLabel(role),
      notes: src.notes,
    },
  });
  await appendAudit({
    actor: { kind: "STAFF", label: roleLabel(role) },
    action: "APPOINTMENT_DUPLICATED",
    targetType: "Appointment",
    targetId: copy.id,
    studyId: src.studyId,
    metadata: { from: src.id, offsetDays },
  });
  revalidatePath(`/admin/studies/${src.studyId}/appointments`);
}

export async function actCancelAppointment(apptId: string) {
  const role = await requireStaff();
  const appt = await prisma.appointment.findUniqueOrThrow({
    where: { id: apptId },
  });
  if (appt.status === "CANCELED") return;
  await prisma.appointment.update({
    where: { id: apptId },
    data: { status: "CANCELED" },
  });
  await appendAudit({
    actor: { kind: "STAFF", label: roleLabel(role) },
    action: "APPOINTMENT_CANCELED",
    targetType: "Appointment",
    targetId: apptId,
    studyId: appt.studyId,
  });
  revalidatePath(`/admin/studies/${appt.studyId}/appointments`);
}

export async function actMarkAppointmentCompleted(apptId: string) {
  const role = await getRole();
  if (role.kind === "ANONYMOUS") throw new Error("Sign in required");
  const appt = await prisma.appointment.findUniqueOrThrow({
    where: { id: apptId },
  });
  if (appt.status === "COMPLETED") return;
  const now = await getSimNow();
  await prisma.appointment.update({
    where: { id: apptId },
    data: { status: "COMPLETED" },
  });
  await appendAudit({
    actor:
      role.kind === "PARTICIPANT"
        ? { kind: "PARTICIPANT", id: role.participantId, label: roleLabel(role) }
        : { kind: "STAFF", label: roleLabel(role) },
    action: "APPOINTMENT_COMPLETED",
    targetType: "Appointment",
    targetId: apptId,
    studyId: appt.studyId,
    metadata: { completedAt: now.toISOString() },
  });
  revalidatePath(`/admin/studies/${appt.studyId}/appointments`);
  revalidatePath("/portal", "layout");
}
