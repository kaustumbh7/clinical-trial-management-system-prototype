"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { appendAudit } from "@/lib/audit/log";
import { getRole, roleLabel } from "@/lib/auth/role";

async function requireStaff() {
  const role = await getRole();
  if (role.kind !== "STAFF") throw new Error("Staff only");
  return role;
}

export async function actCreateStaffUser(formData: FormData) {
  const role = await requireStaff();
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const staffRole = (formData.get("role") as string) || "COORDINATOR";
  if (!name || !email) throw new Error("Name and email required");
  const user = await prisma.staffUser.create({
    data: { name, email, role: staffRole },
  });
  await appendAudit({
    actor: { kind: "STAFF", label: roleLabel(role) },
    action: "STAFF_USER_CREATED",
    targetType: "StaffUser",
    targetId: user.id,
    metadata: { name, email, role: staffRole },
  });
  revalidatePath("/admin/staff");
  redirect("/admin/staff");
}

export async function actAssignStaff(formData: FormData) {
  const role = await requireStaff();
  const participantId = formData.get("participantId") as string;
  const staffId = formData.get("staffId") as string;
  const assignmentRole =
    (formData.get("role") as string) || "PRIMARY_COORDINATOR";
  if (!participantId || !staffId) throw new Error("Participant + staff required");

  // Drop any existing assignment with the same role for this participant
  // (single primary coordinator at a time).
  await prisma.staffAssignment.deleteMany({
    where: { participantId, role: assignmentRole },
  });
  const a = await prisma.staffAssignment.create({
    data: { participantId, staffId, role: assignmentRole },
  });
  const p = await prisma.participant.findUniqueOrThrow({
    where: { id: participantId },
  });
  await appendAudit({
    actor: { kind: "STAFF", label: roleLabel(role) },
    action: "STAFF_ASSIGNED",
    targetType: "Participant",
    targetId: participantId,
    studyId: p.studyId,
    metadata: { staffId, role: assignmentRole },
  });
  revalidatePath(`/admin/studies/${p.studyId}/assignments`);
}

export async function actUnassignStaff(assignmentId: string) {
  const role = await requireStaff();
  const a = await prisma.staffAssignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: { participant: true },
  });
  await prisma.staffAssignment.delete({ where: { id: assignmentId } });
  await appendAudit({
    actor: { kind: "STAFF", label: roleLabel(role) },
    action: "STAFF_UNASSIGNED",
    targetType: "Participant",
    targetId: a.participantId,
    studyId: a.participant.studyId,
    metadata: { staffId: a.staffId, role: a.role },
  });
  revalidatePath(`/admin/studies/${a.participant.studyId}/assignments`);
}
