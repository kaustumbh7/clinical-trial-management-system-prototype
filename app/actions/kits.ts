"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { appendAudit } from "@/lib/audit/log";
import { getRole, roleLabel } from "@/lib/auth/role";
import { getSimNow } from "@/lib/sim-clock";
import { handleEvent } from "@/lib/soe/engine";
import { createShipmentLabel } from "@/lib/mock-vendors/shipping";
import { generateQrToken } from "@/lib/qr";

/**
 * Allocate a kit from the lowest-quantity-but-non-empty lot for the study,
 * generate an outbound shipping label, mark the participant's KIT_SHIP
 * TaskInstance complete, and let the engine emit its derived events.
 */
export async function actAllocateAndShipKit(participantId: string) {
  const role = await getRole();
  if (role.kind !== "STAFF") throw new Error("Staff only");

  const participant = await prisma.participant.findUniqueOrThrow({
    where: { id: participantId },
    include: { study: { include: { kitSkus: { include: { lots: true } } } } },
  });

  const sku = participant.study.kitSkus[0];
  if (!sku) throw new Error("Study has no kit SKU configured");
  const lot = sku.lots
    .filter((l) => l.quantityOnHand > 0)
    .sort((a, b) => a.quantityOnHand - b.quantityOnHand)[0];
  if (!lot) throw new Error("No kits available in any lot");

  const now = await getSimNow();

  // Decrement inventory
  await prisma.kitLot.update({
    where: { id: lot.id },
    data: { quantityOnHand: { decrement: 1 } },
  });

  // Allocate the kit
  const kit = await prisma.kit.create({
    data: {
      lotId: lot.id,
      participantId: participant.id,
      status: "ALLOCATED",
      qrToken: generateQrToken(),
    },
  });

  // Generate outbound shipping label
  const label = await createShipmentLabel({
    kitId: kit.id,
    toName: participant.name,
    toAddressLine: "123 Participant Street, Anytown USA",
    direction: "OUTBOUND",
  });
  await prisma.shipment.create({
    data: {
      kitId: kit.id,
      direction: "OUTBOUND",
      carrier: label.carrier,
      trackingNumber: label.trackingNumber,
      labelPath: label.labelPath,
      status: "IN_TRANSIT",
      createdAt: now,
    },
  });
  await prisma.kit.update({
    where: { id: kit.id },
    data: { status: "SHIPPED" },
  });

  // Find the KIT_SHIP task and mark it complete via the engine
  const shipTask = await prisma.taskInstance.findFirst({
    where: {
      participantId: participant.id,
      status: { in: ["DUE", "PENDING"] },
      template: { kind: "KIT_SHIP" },
    },
  });
  if (shipTask) {
    await handleEvent({
      kind: "TASK_COMPLETED",
      taskId: shipTask.id,
      actorLabel: roleLabel(role),
    });
  }

  await appendAudit({
    actor: { kind: "STAFF", label: roleLabel(role) },
    action: "KIT_ALLOCATED_SHIPPED",
    targetType: "Kit",
    targetId: kit.id,
    studyId: participant.studyId,
    metadata: {
      participantId,
      lot: lot.lotNumber,
      tracking: label.trackingNumber,
      carrier: label.carrier,
    },
  });

  revalidatePath(`/admin/studies/${participant.studyId}`, "layout");
}

/**
 * Participant scans the QR code on the kit. Marks Kit.status=ACTIVATED and
 * completes the KIT_ACTIVATE TaskInstance via the engine.
 */
export async function actActivateKit(qrToken: string) {
  const role = await getRole();
  const kit = await prisma.kit.findUnique({
    where: { qrToken },
    include: { participant: true, lot: { include: { sku: true } } },
  });
  if (!kit) throw new Error("Unknown kit");
  if (!kit.participantId) throw new Error("Kit not assigned to a participant");
  if (role.kind === "PARTICIPANT" && role.participantId !== kit.participantId) {
    throw new Error("Forbidden — this kit belongs to another participant");
  }

  const now = await getSimNow();
  if (kit.status === "ACTIVATED") {
    return { alreadyActivated: true, kitId: kit.id };
  }

  await prisma.kit.update({
    where: { id: kit.id },
    data: { status: "ACTIVATED", activatedAt: now },
  });

  const activateTask = await prisma.taskInstance.findFirst({
    where: {
      participantId: kit.participantId,
      status: { in: ["DUE", "PENDING"] },
      template: { kind: "KIT_ACTIVATE" },
    },
  });
  if (activateTask) {
    await handleEvent({
      kind: "TASK_COMPLETED",
      taskId: activateTask.id,
      actorLabel: roleLabel(role),
    });
  }
  await appendAudit({
    actor: { kind: "PARTICIPANT", id: kit.participantId, label: kit.participant?.name ?? "participant" },
    action: "KIT_ACTIVATED",
    targetType: "Kit",
    targetId: kit.id,
    studyId: kit.lot.sku.studyId,
    metadata: { qrToken },
  });

  revalidatePath("/portal", "layout");
  revalidatePath(`/admin/studies/${kit.lot.sku.studyId}`, "layout");
  return { kitId: kit.id };
}

/**
 * Ship the kit back — generates a return label and flips the kit to
 * RETURN_SHIPPED.
 */
export async function actShipReturn(kitId: string) {
  const role = await getRole();
  const kit = await prisma.kit.findUniqueOrThrow({
    where: { id: kitId },
    include: { participant: true, lot: { include: { sku: true } } },
  });
  if (role.kind === "PARTICIPANT" && role.participantId !== kit.participantId) {
    throw new Error("Forbidden");
  }
  const now = await getSimNow();
  const label = await createShipmentLabel({
    kitId: kit.id,
    toName: "QuidoLabs Sample Intake",
    toAddressLine: "200 Lab Way, Cambridge MA",
    direction: "RETURN",
  });
  await prisma.shipment.create({
    data: {
      kitId: kit.id,
      direction: "RETURN",
      carrier: label.carrier,
      trackingNumber: label.trackingNumber,
      labelPath: label.labelPath,
      status: "IN_TRANSIT",
      createdAt: now,
    },
  });
  await prisma.kit.update({
    where: { id: kit.id },
    data: { status: "RETURN_SHIPPED" },
  });
  const actor =
    role.kind === "PARTICIPANT"
      ? ({ kind: "PARTICIPANT", id: role.participantId, label: roleLabel(role) } as const)
      : ({ kind: "STAFF", label: roleLabel(role) } as const);
  await appendAudit({
    actor,
    action: "RETURN_SHIPPED",
    targetType: "Kit",
    targetId: kit.id,
    studyId: kit.lot.sku.studyId,
    metadata: { tracking: label.trackingNumber },
  });

  // Complete any DUE SAMPLE_RETURN task for the participant
  if (kit.participantId) {
    const returnTask = await prisma.taskInstance.findFirst({
      where: {
        participantId: kit.participantId,
        status: { in: ["DUE", "PENDING"] },
        template: { kind: "SAMPLE_RETURN" },
      },
    });
    if (returnTask) {
      await handleEvent({
        kind: "TASK_COMPLETED",
        taskId: returnTask.id,
        actorLabel: roleLabel(role),
      });
    }
  }

  revalidatePath("/portal", "layout");
  revalidatePath(`/admin/studies/${kit.lot.sku.studyId}`, "layout");
}

/**
 * Sample intake — recorded by lab staff once a return shipment is delivered.
 * Creates a Sample row per tube, marked by the participant's SOE timepoints.
 */
export async function actRecordSampleIntake(input: {
  kitId: string;
  tubeBarcode: string;
  timepointId?: string;
  condition: string;
  notes?: string;
}) {
  const role = await getRole();
  if (role.kind !== "STAFF") throw new Error("Staff only");
  const kit = await prisma.kit.findUniqueOrThrow({
    where: { id: input.kitId },
    include: { lot: { include: { sku: true } } },
  });
  if (!kit.participantId) throw new Error("Kit not assigned");
  const now = await getSimNow();

  const sample = await prisma.sample.create({
    data: {
      kitId: kit.id,
      participantId: kit.participantId,
      timepointId: input.timepointId,
      tubeBarcode: input.tubeBarcode,
      collectedAt: now,
      intakeAt: now,
      condition: input.condition,
      notes: input.notes,
    },
  });

  await appendAudit({
    actor: { kind: "STAFF", label: roleLabel(role) },
    action: "SAMPLE_INTAKE",
    targetType: "Sample",
    targetId: sample.id,
    studyId: kit.lot.sku.studyId,
    metadata: { tube: input.tubeBarcode, condition: input.condition },
  });

  revalidatePath(`/admin/studies/${kit.lot.sku.studyId}`, "layout");
  return sample;
}

/**
 * Activate a kit directly by participant via portal action (server-action form).
 */
export async function actActivateKitFromForm(formData: FormData) {
  const token = (formData.get("token") as string)?.trim();
  if (!token) throw new Error("QR token required");
  await actActivateKit(token);
  redirect("/portal");
}
