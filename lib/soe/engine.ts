import { prisma } from "../db";
import { appendAudit } from "../audit/log";
import { materializeTimeline } from "./rules";
import { getSimNow } from "../sim-clock";
import { chargeMock } from "../mock-vendors/payments";
import { sendMessage } from "../mock-vendors/messages";
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

  // Trigger any PaymentRules whose trigger is TASK_COMPLETED + this template
  await maybeChargeForTaskCompletion(task.participantId, task.templateId, task.participant.studyId);

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
      // Write a real Message row using the participant's study templates
      // when available; otherwise fall back to a default body.
      const reminderTpl = await prisma.messageTemplate.findFirst({
        where: {
          studyId: t.participant.studyId,
          channel: "EMAIL",
          name: { contains: "Reminder" },
          active: true,
        },
      });
      const vars = {
        participant_first: t.participant.name.split(" ")[0] ?? t.participant.name,
        task_name: t.template.name,
        due_date: t.dueAt.toISOString().slice(0, 10),
      };
      const msg = await sendMessage({
        studyId: t.participant.studyId,
        participantId: t.participantId,
        templateId: reminderTpl?.id,
        channel: "EMAIL",
        toAddress: t.participant.email,
        subject:
          reminderTpl?.subject ?? `Reminder: {{task_name}} due {{due_date}}`,
        body:
          reminderTpl?.body ??
          "Hi {{participant_first}}, just a reminder to complete \"{{task_name}}\" — it's due on {{due_date}}.",
        variables: vars,
        now: newDate,
      });
      await appendAudit({
        actor: sysActor,
        action: "REMINDER_SENT",
        targetType: "TaskInstance",
        targetId: t.id,
        studyId: t.participant.studyId,
        metadata: {
          templateName: t.template.name,
          channel: "EMAIL",
          to: t.participant.email,
          messageId: msg.id,
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

  // Type-specific dispatchers — each one keeps audit context to itself.
  if (event.type === "shipping.delivered") {
    await onShippingDelivered(event.payload);
  } else if (event.type === "shipping.return_delivered") {
    await onShippingReturnDelivered(event.payload);
  } else if (event.type === "shipping.lost") {
    await onShippingLost(event.payload);
  } else if (event.type === "payment.settled") {
    await onPaymentSettled(event.payload);
  } else if (event.type === "payment.failed") {
    await onPaymentFailed(event.payload);
  } else if (event.type === "email.delivered" || event.type === "sms.delivered") {
    await onMessageDelivered(event.payload);
  } else if (event.type === "email.bounced") {
    await onMessageBounced(event.payload);
  }

  return { ok: true };
}

async function onMessageDelivered(payload: Record<string, unknown>) {
  const vendorRef =
    (typeof payload.vendorRef === "string" && payload.vendorRef) ||
    (typeof payload.messageId === "string" && payload.messageId) ||
    null;
  const msg = vendorRef
    ? await prisma.message.findUnique({ where: { vendorRef } })
    : await prisma.message.findFirst({
        where: { status: "SENT" },
        orderBy: { sentAt: "desc" },
      });
  if (!msg || msg.status === "DELIVERED") return;
  await prisma.message.update({
    where: { id: msg.id },
    data: { status: "DELIVERED", deliveredAt: await getSimNow() },
  });
}

async function onMessageBounced(payload: Record<string, unknown>) {
  const vendorRef =
    (typeof payload.vendorRef === "string" && payload.vendorRef) ||
    (typeof payload.messageId === "string" && payload.messageId) ||
    null;
  const msg = vendorRef
    ? await prisma.message.findUnique({ where: { vendorRef } })
    : await prisma.message.findFirst({
        where: { status: "SENT" },
        orderBy: { sentAt: "desc" },
      });
  if (!msg) return;
  await prisma.message.update({
    where: { id: msg.id },
    data: {
      status: "BOUNCED",
      failureReason:
        typeof payload.reason === "string" ? payload.reason : "bounced",
    },
  });
}

async function maybeChargeForTaskCompletion(
  participantId: string,
  templateId: string,
  studyId: string,
) {
  const rules = await prisma.paymentRule.findMany({
    where: {
      studyId,
      trigger: "TASK_COMPLETED",
      templateId,
      active: true,
    },
  });
  for (const rule of rules) {
    const charge = await chargeMock({
      participantId,
      ruleId: rule.id,
      amountCents: rule.amountCents,
      currency: rule.currency,
    });
    // Idempotent insert — the processorRef is unique
    const existing = await prisma.paymentEvent.findUnique({
      where: { processorRef: charge.processorRef },
    });
    if (existing) continue;
    const event = await prisma.paymentEvent.create({
      data: {
        participantId,
        ruleId: rule.id,
        amountCents: rule.amountCents,
        currency: rule.currency,
        status: "PENDING",
        processorRef: charge.processorRef,
        requestedAt: await getSimNow(),
      },
    });
    await appendAudit({
      actor: sysActor,
      action: "PAYMENT_REQUESTED",
      targetType: "PaymentEvent",
      targetId: event.id,
      studyId,
      metadata: {
        rule: rule.name,
        amountCents: rule.amountCents,
        processorRef: charge.processorRef,
      },
    });
  }
}

async function onPaymentSettled(payload: Record<string, unknown>) {
  const processorRef =
    typeof payload.processorRef === "string" ? payload.processorRef : null;
  // Settle the most-recent PENDING event if no ref provided — useful for demo
  const event = processorRef
    ? await prisma.paymentEvent.findUnique({
        where: { processorRef },
        include: { rule: true, participant: true },
      })
    : await prisma.paymentEvent.findFirst({
        where: { status: "PENDING" },
        include: { rule: true, participant: true },
        orderBy: { requestedAt: "asc" },
      });
  if (!event || event.status !== "PENDING") return;
  const now = await getSimNow();
  await prisma.paymentEvent.update({
    where: { id: event.id },
    data: { status: "SETTLED", settledAt: now },
  });
  await appendAudit({
    actor: sysActor,
    action: "PAYMENT_SETTLED",
    targetType: "PaymentEvent",
    targetId: event.id,
    studyId: event.rule.studyId,
    metadata: {
      rule: event.rule.name,
      amountCents: event.amountCents,
      processorRef: event.processorRef,
    },
  });
}

async function onPaymentFailed(payload: Record<string, unknown>) {
  const processorRef =
    typeof payload.processorRef === "string" ? payload.processorRef : null;
  const event = processorRef
    ? await prisma.paymentEvent.findUnique({
        where: { processorRef },
        include: { rule: true },
      })
    : await prisma.paymentEvent.findFirst({
        where: { status: "PENDING" },
        include: { rule: true },
        orderBy: { requestedAt: "asc" },
      });
  if (!event || event.status !== "PENDING") return;
  await prisma.paymentEvent.update({
    where: { id: event.id },
    data: {
      status: "FAILED",
      failureReason:
        typeof payload.reason === "string" ? payload.reason : "processor_decline",
    },
  });
  await appendAudit({
    actor: sysActor,
    action: "PAYMENT_FAILED",
    targetType: "PaymentEvent",
    targetId: event.id,
    studyId: event.rule.studyId,
    metadata: { rule: event.rule.name, reason: payload.reason ?? null },
  });
}

async function onShippingDelivered(payload: Record<string, unknown>) {
  const trackingNumber =
    typeof payload.trackingNumber === "string" ? payload.trackingNumber : null;
  if (!trackingNumber) return;
  const shipment = await prisma.shipment.findUnique({
    where: { trackingNumber },
    include: { kit: { include: { participant: true, lot: { include: { sku: true } } } } },
  });
  if (!shipment || shipment.direction !== "OUTBOUND") return;
  const now = await getSimNow();

  await prisma.shipment.update({
    where: { id: shipment.id },
    data: { status: "DELIVERED", deliveredAt: now },
  });
  await prisma.kit.update({
    where: { id: shipment.kitId },
    data: { status: "DELIVERED" },
  });

  // Flip the participant's PENDING KIT_ACTIVATE task → DUE
  if (shipment.kit.participantId) {
    const activateTasks = await prisma.taskInstance.findMany({
      where: {
        participantId: shipment.kit.participantId,
        status: "PENDING",
        template: { kind: "KIT_ACTIVATE" },
      },
      include: { template: true, participant: true },
    });
    for (const t of activateTasks) {
      await prisma.taskInstance.update({
        where: { id: t.id },
        data: { status: "DUE", availableAt: now },
      });
      await appendAudit({
        actor: sysActor,
        action: "TASK_BECAME_DUE",
        targetType: "TaskInstance",
        targetId: t.id,
        studyId: t.participant.studyId,
        metadata: { reason: "kit_delivered", templateName: t.template.name },
      });
    }
    await appendAudit({
      actor: sysActor,
      action: "KIT_DELIVERED",
      targetType: "Kit",
      targetId: shipment.kitId,
      studyId: shipment.kit.lot.sku.studyId,
      metadata: { trackingNumber, sku: shipment.kit.lot.sku.code },
    });
  }
}

async function onShippingReturnDelivered(payload: Record<string, unknown>) {
  const trackingNumber =
    typeof payload.trackingNumber === "string" ? payload.trackingNumber : null;
  if (!trackingNumber) return;
  const shipment = await prisma.shipment.findUnique({
    where: { trackingNumber },
    include: { kit: { include: { lot: { include: { sku: true } } } } },
  });
  if (!shipment || shipment.direction !== "RETURN") return;
  const now = await getSimNow();

  await prisma.shipment.update({
    where: { id: shipment.id },
    data: { status: "DELIVERED", deliveredAt: now },
  });
  await prisma.kit.update({
    where: { id: shipment.kitId },
    data: { status: "RETURNED" },
  });
  await appendAudit({
    actor: sysActor,
    action: "KIT_RETURNED",
    targetType: "Kit",
    targetId: shipment.kitId,
    studyId: shipment.kit.lot.sku.studyId,
    metadata: { trackingNumber },
  });
}

async function onShippingLost(payload: Record<string, unknown>) {
  const trackingNumber =
    typeof payload.trackingNumber === "string" ? payload.trackingNumber : null;
  if (!trackingNumber) return;
  const shipment = await prisma.shipment.findUnique({
    where: { trackingNumber },
    include: { kit: { include: { lot: { include: { sku: true } } } } },
  });
  if (!shipment) return;

  await prisma.shipment.update({
    where: { id: shipment.id },
    data: { status: "LOST" },
  });
  await prisma.kit.update({
    where: { id: shipment.kitId },
    data: { status: "LOST" },
  });
  await appendAudit({
    actor: sysActor,
    action: "KIT_LOST",
    targetType: "Kit",
    targetId: shipment.kitId,
    studyId: shipment.kit.lot.sku.studyId,
    metadata: { trackingNumber, direction: shipment.direction },
  });
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

/**
 * Pause the participant's currently-pending/due survey + appointment tasks
 * when a SERIOUS adverse event with autoStreamPause is reported. Original
 * status is preserved in the task's `payload` JSON so the engine can
 * restore on AE resolution.
 */
export async function pauseStreamForAe(
  participantId: string,
  aeId: string,
  studyId: string,
) {
  const tasks = await prisma.taskInstance.findMany({
    where: {
      participantId,
      status: { in: ["PENDING", "DUE"] },
      template: { kind: { in: ["SURVEY", "VISIT", "SAMPLE_COLLECT"] } },
    },
  });
  for (const t of tasks) {
    const prev = JSON.parse(t.payload ?? "{}") as Record<string, unknown>;
    await prisma.taskInstance.update({
      where: { id: t.id },
      data: {
        status: "SKIPPED",
        payload: JSON.stringify({
          ...prev,
          stream_pause: { prevStatus: t.status, aeId, pausedAt: new Date().toISOString() },
        }),
      },
    });
  }
  await appendAudit({
    actor: sysActor,
    action: "STREAM_PAUSED",
    targetType: "Participant",
    targetId: participantId,
    studyId,
    metadata: { aeId, tasksPaused: tasks.length },
  });
  return { tasksPaused: tasks.length };
}

/**
 * Restore tasks that were stream-paused by a specific AE.
 */
export async function resumeStreamFromAe(
  participantId: string,
  aeId: string,
  studyId: string,
) {
  const tasks = await prisma.taskInstance.findMany({
    where: { participantId, status: "SKIPPED" },
  });
  let resumed = 0;
  for (const t of tasks) {
    const payload = JSON.parse(t.payload ?? "{}") as {
      stream_pause?: { prevStatus: string; aeId: string };
    };
    if (payload.stream_pause?.aeId !== aeId) continue;
    const prevStatus = payload.stream_pause.prevStatus as
      | "PENDING"
      | "DUE";
    delete payload.stream_pause;
    await prisma.taskInstance.update({
      where: { id: t.id },
      data: {
        status: prevStatus,
        payload: Object.keys(payload).length
          ? JSON.stringify(payload)
          : null,
      },
    });
    resumed++;
  }
  await appendAudit({
    actor: sysActor,
    action: "STREAM_RESUMED",
    targetType: "Participant",
    targetId: participantId,
    studyId,
    metadata: { aeId, tasksResumed: resumed },
  });
  return { tasksResumed: resumed };
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
