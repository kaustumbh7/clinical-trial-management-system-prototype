"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { appendAudit } from "@/lib/audit/log";
import { getRole, roleLabel } from "@/lib/auth/role";
import { getSimNow } from "@/lib/sim-clock";
import { sendMessage } from "@/lib/mock-vendors/messages";

async function requireStaff() {
  const role = await getRole();
  if (role.kind !== "STAFF") throw new Error("Staff only");
  return role;
}

export async function actUpsertMessageTemplate(formData: FormData) {
  const role = await requireStaff();
  const studyId = formData.get("studyId") as string;
  const templateId = (formData.get("templateId") as string) || null;
  const channel = (formData.get("channel") as string) || "EMAIL";
  const name = (formData.get("name") as string)?.trim();
  const subject = (formData.get("subject") as string)?.trim() || null;
  const body = (formData.get("body") as string)?.trim();
  if (!studyId || !name || !body) throw new Error("Required fields missing");

  if (templateId) {
    await prisma.messageTemplate.update({
      where: { id: templateId },
      data: { channel, name, subject, body },
    });
    await appendAudit({
      actor: { kind: "STAFF", label: roleLabel(role) },
      action: "MSG_TEMPLATE_UPDATED",
      targetType: "MessageTemplate",
      targetId: templateId,
      studyId,
    });
  } else {
    const tpl = await prisma.messageTemplate.create({
      data: { studyId, channel, name, subject, body },
    });
    await appendAudit({
      actor: { kind: "STAFF", label: roleLabel(role) },
      action: "MSG_TEMPLATE_CREATED",
      targetType: "MessageTemplate",
      targetId: tpl.id,
      studyId,
    });
  }
  revalidatePath(`/admin/studies/${studyId}/communications/templates`);
  redirect(`/admin/studies/${studyId}/communications/templates`);
}

export async function actSendManualMessage(formData: FormData) {
  const role = await requireStaff();
  const studyId = formData.get("studyId") as string;
  const participantId = (formData.get("participantId") as string) || null;
  const templateId = (formData.get("templateId") as string) || null;
  const channel = (formData.get("channel") as string) || "EMAIL";

  if (!studyId) throw new Error("Study required");

  let subject: string | null = null;
  let body: string;
  let toAddress: string;
  let vars: Record<string, string> = {};

  if (templateId) {
    const tpl = await prisma.messageTemplate.findUniqueOrThrow({
      where: { id: templateId },
    });
    subject = tpl.subject;
    body = tpl.body;
  } else {
    subject = (formData.get("subject") as string) || null;
    body = (formData.get("body") as string) || "";
  }

  if (participantId) {
    const p = await prisma.participant.findUniqueOrThrow({
      where: { id: participantId },
    });
    toAddress = p.email;
    vars = {
      participant_first: p.name.split(" ")[0] ?? p.name,
      participant_name: p.name,
    };
  } else {
    toAddress = (formData.get("toAddress") as string) || "";
    if (!toAddress) throw new Error("Address required if no participant");
  }

  const now = await getSimNow();
  const msg = await sendMessage({
    studyId,
    participantId: participantId ?? undefined,
    templateId: templateId ?? undefined,
    channel: channel as "EMAIL" | "SMS",
    toAddress,
    subject: subject ?? undefined,
    body,
    variables: vars,
    now,
  });
  await appendAudit({
    actor: { kind: "STAFF", label: roleLabel(role) },
    action: "MESSAGE_SENT_MANUAL",
    targetType: "Message",
    targetId: msg.id,
    studyId,
    metadata: { channel, to: toAddress, templateId },
  });
  revalidatePath(`/admin/studies/${studyId}/communications`);
  revalidatePath("/portal/inbox");
}
