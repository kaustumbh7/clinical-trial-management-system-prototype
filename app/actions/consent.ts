"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getRole } from "@/lib/auth/role";
import { generateSignedConsent } from "@/lib/mock-vendors/esign";
import { appendAudit } from "@/lib/audit/log";
import { enrollParticipant } from "@/lib/soe/engine";
import { materializeConsentTask } from "@/lib/soe/rules";
import { getSimNow } from "@/lib/sim-clock";

export async function actSignConsent(formData: FormData) {
  const role = await getRole();
  if (role.kind !== "PARTICIPANT") {
    throw new Error("Must be signed in as a participant");
  }
  const typedName = (formData.get("signatureName") as string)?.trim();
  const agree = formData.get("agree") === "on";
  if (!typedName || !agree) {
    throw new Error("Signature and agreement required");
  }

  const participant = await prisma.participant.findUniqueOrThrow({
    where: { id: role.participantId },
    include: { study: true },
  });

  if (participant.status === "ENROLLED" || participant.status === "COMPLETED") {
    redirect("/portal");
  }

  const now = await getSimNow();

  const signed = await generateSignedConsent({
    participantId: participant.id,
    participantName: participant.name,
    studyCode: participant.study.code,
    signatureName: typedName,
    signedAt: now,
  });

  const consent = await prisma.consentRecord.create({
    data: {
      participantId: participant.id,
      version: "v1.0",
      signatureName: typedName,
      signedAt: now,
      pdfBlobPath: signed.relPath,
    },
  });

  await appendAudit({
    actor: {
      kind: "PARTICIPANT",
      id: participant.id,
      label: participant.name,
    },
    action: "CONSENT_SIGNED",
    targetType: "ConsentRecord",
    targetId: consent.id,
    studyId: participant.studyId,
    metadata: { version: consent.version, signatureName: typedName },
  });

  await prisma.participant.update({
    where: { id: participant.id },
    data: { status: "CONSENTED" },
  });

  // Mark the consent task (if present) as completed
  await prisma.taskInstance.updateMany({
    where: {
      participantId: participant.id,
      template: { kind: "CONSENT" },
      status: { in: ["DUE", "PENDING"] },
    },
    data: { status: "COMPLETED", completedAt: now },
  });

  await enrollParticipant(participant.id, now, {
    kind: "SYSTEM",
    label: "consent-flow",
  });

  revalidatePath("/portal", "layout");
  revalidatePath("/admin", "layout");
  redirect("/portal");
}

/**
 * Used by the screener flow: when a lead qualifies and becomes a Participant,
 * we plant the consent task so they see something actionable in the portal.
 */
export async function ensureConsentTask(participantId: string, studyId: string) {
  const existing = await prisma.taskInstance.findFirst({
    where: {
      participantId,
      template: { kind: "CONSENT" },
    },
  });
  if (existing) return existing;
  const now = await getSimNow();
  return materializeConsentTask(participantId, studyId, now);
}
