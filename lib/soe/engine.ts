import { prisma } from "../db";
import { appendAudit } from "../audit/log";
import { materializeTimeline } from "./rules";
import type { EngineEvent, ActorRef } from "./types";

/**
 * The SOE engine. A single entry point — `handleEvent` — receives every
 * trigger and decides what derived state changes follow. This is the
 * "event spine" the proposal centers on: every other module either feeds
 * an event in or subscribes to one going out.
 *
 * For the prototype, "subscribers" are inline calls rather than a real
 * pub/sub bus — but the shape is preserved so a real bus is a refactor
 * not a rewrite.
 */

const sysActor: ActorRef = { kind: "SYSTEM", label: "soe-engine" };

export async function enrollParticipant(
  participantId: string,
  enrolledAt: Date,
  actor: ActorRef,
) {
  const participant = await prisma.participant.findUniqueOrThrow({
    where: { id: participantId },
  });

  await prisma.participant.update({
    where: { id: participantId },
    data: { status: "ENROLLED", enrolledAt },
  });

  const count = await materializeTimeline(
    participantId,
    participant.studyId,
    enrolledAt,
  );

  await appendAudit({
    actor,
    action: "PARTICIPANT_ENROLLED",
    targetType: "Participant",
    targetId: participantId,
    studyId: participant.studyId,
    metadata: { enrolledAt: enrolledAt.toISOString(), tasksMaterialized: count },
  });

  return { tasksMaterialized: count };
}

export async function handleEvent(event: EngineEvent) {
  switch (event.kind) {
    case "TASK_COMPLETED":
      return handleTaskCompleted(event);
    case "CLOCK_TICK":
      return handleClockTick(event);
    case "WEBHOOK_RECEIVED":
      return handleWebhook(event);
    case "MANUAL_OVERRIDE":
      return handleManualOverride(event);
  }
}

async function handleTaskCompleted(event: Extract<EngineEvent, { kind: "TASK_COMPLETED" }>) {
  const task = await prisma.taskInstance.findUniqueOrThrow({
    where: { id: event.taskId },
    include: { template: true, participant: true },
  });

  if (task.status === "COMPLETED") return { ok: true, idempotent: true };

  const now = new Date();
  await prisma.taskInstance.update({
    where: { id: task.id },
    data: { status: "COMPLETED", completedAt: now },
  });

  await appendAudit({
    actor: { kind: "PARTICIPANT", id: task.participantId, label: event.actorLabel },
    action: "TASK_COMPLETED",
    targetType: "TaskInstance",
    targetId: task.id,
    studyId: task.participant.studyId,
    metadata: { templateName: task.template.name },
  });

  // Activate any COMPLETION-triggered tasks that depend on this template
  const dependents = await prisma.taskInstance.findMany({
    where: {
      participantId: task.participantId,
      status: "PENDING",
      template: { dependsOnTemplateId: task.templateId, triggerType: "COMPLETION" },
    },
    include: { template: true },
  });

  for (const dep of dependents) {
    await prisma.taskInstance.update({
      where: { id: dep.id },
      data: { status: "DUE", availableAt: now },
    });
    await appendAudit({
      actor: sysActor,
      action: "TASK_BECAME_DUE",
      targetType: "TaskInstance",
      targetId: dep.id,
      studyId: task.participant.studyId,
      metadata: { reason: "dependency_completed", templateName: dep.template.name },
    });
  }

  return { ok: true, activated: dependents.length };
}

async function handleClockTick(event: Extract<EngineEvent, { kind: "CLOCK_TICK" }>) {
  const { previousDate, newDate } = event;

  // PENDING time-triggered tasks whose dueAt is now in the past → DUE
  const becameDue = await prisma.taskInstance.findMany({
    where: {
      status: "PENDING",
      template: { triggerType: "TIME" },
      dueAt: { lte: newDate },
    },
    include: { template: true, participant: true },
  });

  for (const t of becameDue) {
    await prisma.taskInstance.update({
      where: { id: t.id },
      data: { status: "DUE" },
    });
    await appendAudit({
      actor: sysActor,
      action: "TASK_BECAME_DUE",
      targetType: "TaskInstance",
      targetId: t.id,
      studyId: t.participant.studyId,
      metadata: { reason: "time_trigger", templateName: t.template.name },
    });
  }

  // DUE tasks whose dueAt has fully elapsed (≥ 3 sim days past due) → OVERDUE
  const overdueCutoff = new Date(newDate.getTime() - 3 * 24 * 60 * 60 * 1000);
  const becameOverdue = await prisma.taskInstance.findMany({
    where: {
      status: "DUE",
      dueAt: { lte: overdueCutoff },
    },
    include: { template: true, participant: true },
  });

  for (const t of becameOverdue) {
    await prisma.taskInstance.update({
      where: { id: t.id },
      data: { status: "OVERDUE" },
    });
    await appendAudit({
      actor: sysActor,
      action: "TASK_OVERDUE",
      targetType: "TaskInstance",
      targetId: t.id,
      studyId: t.participant.studyId,
      metadata: { templateName: t.template.name },
    });
  }

  // Fire reminders for tasks whose reminderOffsetDays has been reached
  const reminders = await prisma.taskInstance.findMany({
    where: {
      status: "DUE",
      template: { reminderOffsetDays: { not: null } },
    },
    include: { template: true, participant: true },
  });

  let remindersSent = 0;
  for (const t of reminders) {
    const offsetDays = t.template.reminderOffsetDays ?? 0;
    const reminderAt = new Date(t.dueAt.getTime() + offsetDays * 24 * 60 * 60 * 1000);
    if (reminderAt <= newDate && reminderAt > previousDate) {
      await appendAudit({
        actor: sysActor,
        action: "REMINDER_SENT",
        targetType: "TaskInstance",
        targetId: t.id,
        studyId: t.participant.studyId,
        metadata: {
          templateName: t.template.name,
          channel: "email+sms",
          to: t.participant.email,
        },
      });
      remindersSent++;
    }
  }

  await appendAudit({
    actor: sysActor,
    action: "CLOCK_TICK",
    targetType: "SimClock",
    targetId: "singleton",
    metadata: {
      from: previousDate.toISOString(),
      to: newDate.toISOString(),
      becameDue: becameDue.length,
      becameOverdue: becameOverdue.length,
      remindersSent,
    },
  });

  return {
    becameDue: becameDue.length,
    becameOverdue: becameOverdue.length,
    remindersSent,
  };
}

async function handleWebhook(event: Extract<EngineEvent, { kind: "WEBHOOK_RECEIVED" }>) {
  await appendAudit({
    actor: { kind: "SYSTEM", label: `webhook:${event.vendor}` },
    action: "WEBHOOK_RECEIVED",
    targetType: "Vendor",
    targetId: event.vendor,
    metadata: { type: event.type, ...event.payload },
  });
  return { ok: true };
}

async function handleManualOverride(
  event: Extract<EngineEvent, { kind: "MANUAL_OVERRIDE" }>,
) {
  const task = await prisma.taskInstance.findUniqueOrThrow({
    where: { id: event.taskId },
    include: { participant: true, template: true },
  });

  await prisma.taskInstance.update({
    where: { id: task.id },
    data: {
      status: event.nextStatus,
      completedAt: event.nextStatus === "COMPLETED" ? new Date() : task.completedAt,
    },
  });

  await appendAudit({
    actor: { kind: "STAFF", label: event.actorLabel },
    action: "TASK_MANUAL_OVERRIDE",
    targetType: "TaskInstance",
    targetId: task.id,
    studyId: task.participant.studyId,
    metadata: {
      from: task.status,
      to: event.nextStatus,
      templateName: task.template.name,
    },
  });

  return { ok: true };
}

export async function advanceSimClock(targetDate: Date, actorLabel: string) {
  const clock = await prisma.simClock.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", currentDate: targetDate },
  });
  const previousDate = clock.currentDate;
  if (targetDate <= previousDate) {
    return { unchanged: true, currentDate: previousDate };
  }

  await prisma.simClock.update({
    where: { id: "singleton" },
    data: { currentDate: targetDate },
  });

  const result = await handleEvent({
    kind: "CLOCK_TICK",
    previousDate,
    newDate: targetDate,
  });

  await appendAudit({
    actor: { kind: "STAFF", label: actorLabel },
    action: "SIM_CLOCK_ADVANCED",
    targetType: "SimClock",
    targetId: "singleton",
    metadata: {
      from: previousDate.toISOString(),
      to: targetDate.toISOString(),
    },
  });

  return { previousDate, newDate: targetDate, ...result };
}
