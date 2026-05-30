"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { appendAudit } from "@/lib/audit/log";
import { getRole, roleLabel } from "@/lib/auth/role";
import { getSimNow } from "@/lib/sim-clock";
import { pauseStreamForAe, resumeStreamFromAe } from "@/lib/soe/engine";

async function requireStaff() {
  const role = await getRole();
  if (role.kind !== "STAFF") throw new Error("Staff only");
  return role;
}

export async function actReportAe(formData: FormData) {
  const role = await getRole();
  if (role.kind !== "PARTICIPANT" && role.kind !== "STAFF") {
    throw new Error("Sign in required");
  }
  const participantId = (formData.get("participantId") as string) ||
    (role.kind === "PARTICIPANT" ? role.participantId : "");
  if (!participantId) throw new Error("Participant required");

  const participant = await prisma.participant.findUniqueOrThrow({
    where: { id: participantId },
  });
  const template = await prisma.aeReportTemplate.findFirstOrThrow({
    where: { studyId: participant.studyId, active: true },
  });

  const severity = (formData.get("severity") as string) || "MILD";
  const summary = (formData.get("summary") as string)?.trim() || null;
  const fields: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("field_") && typeof v === "string") {
      fields[k.replace("field_", "")] = v;
    }
  }
  const now = await getSimNow();
  const ae = await prisma.adverseEvent.create({
    data: {
      studyId: participant.studyId,
      participantId,
      templateId: template.id,
      severity,
      summary,
      fields: JSON.stringify(fields),
      reportedAt: now,
    },
  });
  await appendAudit({
    actor:
      role.kind === "PARTICIPANT"
        ? { kind: "PARTICIPANT", id: role.participantId, label: roleLabel(role) }
        : { kind: "STAFF", label: roleLabel(role) },
    action: "AE_REPORTED",
    targetType: "AdverseEvent",
    targetId: ae.id,
    studyId: participant.studyId,
    metadata: { severity, summaryLength: summary?.length ?? 0 },
  });

  if (severity === "SERIOUS" && template.autoStreamPause) {
    await pauseStreamForAe(participantId, ae.id, participant.studyId);
  }

  revalidatePath("/portal", "layout");
  revalidatePath(`/admin/studies/${participant.studyId}`, "layout");

  if (role.kind === "PARTICIPANT") redirect("/portal");
  redirect(`/admin/studies/${participant.studyId}/ae`);
}

export async function actTriageAe(aeId: string) {
  const role = await requireStaff();
  const ae = await prisma.adverseEvent.findUniqueOrThrow({
    where: { id: aeId },
  });
  if (ae.status !== "REPORTED") return;
  await prisma.adverseEvent.update({
    where: { id: aeId },
    data: { status: "TRIAGED", triagedAt: await getSimNow() },
  });
  await appendAudit({
    actor: { kind: "STAFF", label: roleLabel(role) },
    action: "AE_TRIAGED",
    targetType: "AdverseEvent",
    targetId: aeId,
    studyId: ae.studyId,
  });
  revalidatePath(`/admin/studies/${ae.studyId}/ae`);
}

export async function actResolveAe(formData: FormData) {
  const role = await requireStaff();
  const aeId = formData.get("aeId") as string;
  const resolution = (formData.get("resolution") as string)?.trim() || null;
  const ae = await prisma.adverseEvent.findUniqueOrThrow({
    where: { id: aeId },
  });
  if (ae.status === "RESOLVED" || ae.status === "CLOSED") return;
  const now = await getSimNow();
  await prisma.adverseEvent.update({
    where: { id: aeId },
    data: { status: "RESOLVED", resolvedAt: now, resolution },
  });
  await appendAudit({
    actor: { kind: "STAFF", label: roleLabel(role) },
    action: "AE_RESOLVED",
    targetType: "AdverseEvent",
    targetId: aeId,
    studyId: ae.studyId,
    metadata: { resolution },
  });
  await resumeStreamFromAe(ae.participantId, ae.id, ae.studyId);
  revalidatePath(`/admin/studies/${ae.studyId}/ae`);
  revalidatePath("/portal", "layout");
}

export async function actCloseAe(aeId: string) {
  const role = await requireStaff();
  const ae = await prisma.adverseEvent.findUniqueOrThrow({
    where: { id: aeId },
  });
  if (ae.status !== "RESOLVED") return;
  await prisma.adverseEvent.update({
    where: { id: aeId },
    data: { status: "CLOSED", closedAt: await getSimNow() },
  });
  await appendAudit({
    actor: { kind: "STAFF", label: roleLabel(role) },
    action: "AE_CLOSED",
    targetType: "AdverseEvent",
    targetId: aeId,
    studyId: ae.studyId,
  });
  revalidatePath(`/admin/studies/${ae.studyId}/ae`);
}

export async function actUpsertAeTemplate(formData: FormData) {
  const role = await requireStaff();
  const studyId = formData.get("studyId") as string;
  const templateId = (formData.get("templateId") as string) || null;
  const name = (formData.get("name") as string)?.trim();
  const fieldsJson = (formData.get("fields") as string) || "[]";
  const autoStreamPause = formData.get("autoStreamPause") === "on";

  if (!studyId || !name) throw new Error("Study and name required");

  if (templateId) {
    await prisma.aeReportTemplate.update({
      where: { id: templateId },
      data: { name, fields: fieldsJson, autoStreamPause },
    });
    await appendAudit({
      actor: { kind: "STAFF", label: roleLabel(role) },
      action: "AE_TEMPLATE_UPDATED",
      targetType: "AeReportTemplate",
      targetId: templateId,
      studyId,
    });
  } else {
    const tpl = await prisma.aeReportTemplate.create({
      data: { studyId, name, fields: fieldsJson, autoStreamPause },
    });
    await appendAudit({
      actor: { kind: "STAFF", label: roleLabel(role) },
      action: "AE_TEMPLATE_CREATED",
      targetType: "AeReportTemplate",
      targetId: tpl.id,
      studyId,
    });
  }
  revalidatePath(`/admin/studies/${studyId}/ae/templates`);
  redirect(`/admin/studies/${studyId}/ae/templates`);
}
