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

export async function actCreateStudy(formData: FormData) {
  const role = await requireStaff();
  const name = (formData.get("name") as string)?.trim();
  const code = (formData.get("code") as string)?.trim().toUpperCase();
  if (!name || !code) throw new Error("Name and code required");

  const study = await prisma.study.create({
    data: { name, code, status: "DRAFT" },
  });
  // Default arm + enrollment timepoint, so the study isn't empty.
  await prisma.studyArm.create({
    data: { studyId: study.id, name: "Default arm", capacity: 50 },
  });
  await prisma.timepoint.create({
    data: { studyId: study.id, name: "Enrollment", dayOffset: 0 },
  });
  await appendAudit({
    actor: { kind: "STAFF", label: roleLabel(role) },
    action: "STUDY_CREATED",
    targetType: "Study",
    targetId: study.id,
    studyId: study.id,
    metadata: { name, code },
  });
  revalidatePath("/admin");
  redirect(`/admin/studies/${study.id}/edit`);
}

export async function actUpdateStudy(formData: FormData) {
  const role = await requireStaff();
  const studyId = formData.get("studyId") as string;
  const name = (formData.get("name") as string)?.trim();
  const code = (formData.get("code") as string)?.trim().toUpperCase();
  const status = (formData.get("status") as string) || "ACTIVE";
  if (!studyId || !name || !code) throw new Error("Required fields missing");
  await prisma.study.update({
    where: { id: studyId },
    data: { name, code, status },
  });
  await appendAudit({
    actor: { kind: "STAFF", label: roleLabel(role) },
    action: "STUDY_UPDATED",
    targetType: "Study",
    targetId: studyId,
    studyId,
    metadata: { name, code, status },
  });
  revalidatePath(`/admin/studies/${studyId}`, "layout");
  revalidatePath("/admin", "layout");
}

export async function actAddArm(formData: FormData) {
  const role = await requireStaff();
  const studyId = formData.get("studyId") as string;
  const name = (formData.get("name") as string)?.trim();
  const capacity = parseInt((formData.get("capacity") as string) || "50", 10);
  if (!studyId || !name) throw new Error("Required fields missing");
  const arm = await prisma.studyArm.create({
    data: { studyId, name, capacity },
  });
  await appendAudit({
    actor: { kind: "STAFF", label: roleLabel(role) },
    action: "STUDY_ARM_ADDED",
    targetType: "StudyArm",
    targetId: arm.id,
    studyId,
    metadata: { name, capacity },
  });
  revalidatePath(`/admin/studies/${studyId}/edit`);
}

export async function actAddTimepoint(formData: FormData) {
  const role = await requireStaff();
  const studyId = formData.get("studyId") as string;
  const name = (formData.get("name") as string)?.trim();
  const dayOffset = parseInt((formData.get("dayOffset") as string) || "0", 10);
  if (!studyId || !name) throw new Error("Required fields missing");
  const tp = await prisma.timepoint.create({
    data: { studyId, name, dayOffset },
  });
  await appendAudit({
    actor: { kind: "STAFF", label: roleLabel(role) },
    action: "TIMEPOINT_ADDED",
    targetType: "Timepoint",
    targetId: tp.id,
    studyId,
    metadata: { name, dayOffset },
  });
  revalidatePath(`/admin/studies/${studyId}/edit`);
  revalidatePath(`/admin/studies/${studyId}/soe/edit`);
}

export async function actAddSoeTask(formData: FormData) {
  const role = await requireStaff();
  const studyId = formData.get("studyId") as string;
  const timepointId = (formData.get("timepointId") as string) || null;
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const kind = (formData.get("kind") as string) || "SURVEY";
  const triggerType = (formData.get("triggerType") as string) || "TIME";
  const dependsOnTemplateId =
    (formData.get("dependsOnTemplateId") as string) || null;
  const reminderOffsetDays = formData.get("reminderOffsetDays")
    ? parseInt(formData.get("reminderOffsetDays") as string, 10)
    : null;
  if (!studyId || !name) throw new Error("Required fields missing");

  const existing = await prisma.soeTaskTemplate.count({ where: { studyId } });
  const tpl = await prisma.soeTaskTemplate.create({
    data: {
      studyId,
      timepointId,
      name,
      description,
      kind,
      triggerType,
      dependsOnTemplateId,
      reminderOffsetDays,
      sortOrder: existing,
    },
  });
  await appendAudit({
    actor: { kind: "STAFF", label: roleLabel(role) },
    action: "SOE_TASK_ADDED",
    targetType: "SoeTaskTemplate",
    targetId: tpl.id,
    studyId,
    metadata: { name, kind, triggerType },
  });
  revalidatePath(`/admin/studies/${studyId}/soe`);
  revalidatePath(`/admin/studies/${studyId}/soe/edit`);
}

export async function actUpdateSoeTask(formData: FormData) {
  const role = await requireStaff();
  const id = formData.get("templateId") as string;
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const reminderOffsetDays = formData.get("reminderOffsetDays")
    ? parseInt(formData.get("reminderOffsetDays") as string, 10)
    : null;
  if (!id || !name) throw new Error("Required fields missing");
  const tpl = await prisma.soeTaskTemplate.update({
    where: { id },
    data: { name, description, reminderOffsetDays },
  });
  await appendAudit({
    actor: { kind: "STAFF", label: roleLabel(role) },
    action: "SOE_TASK_UPDATED",
    targetType: "SoeTaskTemplate",
    targetId: tpl.id,
    studyId: tpl.studyId,
  });
  revalidatePath(`/admin/studies/${tpl.studyId}/soe`);
  revalidatePath(`/admin/studies/${tpl.studyId}/soe/edit`);
}

export async function actDeleteSoeTask(templateId: string) {
  const role = await requireStaff();
  const tpl = await prisma.soeTaskTemplate.findUniqueOrThrow({
    where: { id: templateId },
  });
  // Only allow delete if no TaskInstance has been materialised — preserves
  // the invariant that existing enrollments are pinned to their original SOE.
  const used = await prisma.taskInstance.count({
    where: { templateId: tpl.id },
  });
  if (used > 0) {
    throw new Error(
      `Cannot delete — ${used} task instance(s) reference this template. Disable instead.`,
    );
  }
  await prisma.soeTaskTemplate.delete({ where: { id: tpl.id } });
  await appendAudit({
    actor: { kind: "STAFF", label: roleLabel(role) },
    action: "SOE_TASK_DELETED",
    targetType: "SoeTaskTemplate",
    targetId: tpl.id,
    studyId: tpl.studyId,
  });
  revalidatePath(`/admin/studies/${tpl.studyId}/soe`);
  revalidatePath(`/admin/studies/${tpl.studyId}/soe/edit`);
}

/**
 * Clone a study's CONFIGURATION (arms, timepoints, SOE template,
 * payment rules, AE templates, message templates) — never the
 * participants, kits, samples, payments, etc.
 */
export async function actCloneStudy(formData: FormData) {
  const role = await requireStaff();
  const sourceId = formData.get("studyId") as string;
  const newName = (formData.get("newName") as string)?.trim();
  const newCode = (formData.get("newCode") as string)?.trim().toUpperCase();
  if (!sourceId || !newName || !newCode) throw new Error("Required fields missing");

  const source = await prisma.study.findUniqueOrThrow({
    where: { id: sourceId },
    include: {
      arms: true,
      timepoints: true,
      templates: true,
      paymentRules: true,
      budgetLines: true,
      aeTemplates: true,
      messageTemplates: true,
    },
  });

  const clone = await prisma.study.create({
    data: { name: newName, code: newCode, status: "DRAFT" },
  });

  // Maps from original ids → clone ids so we can re-link FKs after copy
  const armIdMap = new Map<string, string>();
  for (const a of source.arms) {
    const c = await prisma.studyArm.create({
      data: { studyId: clone.id, name: a.name, capacity: a.capacity },
    });
    armIdMap.set(a.id, c.id);
  }
  const timepointIdMap = new Map<string, string>();
  for (const tp of source.timepoints) {
    const c = await prisma.timepoint.create({
      data: { studyId: clone.id, name: tp.name, dayOffset: tp.dayOffset },
    });
    timepointIdMap.set(tp.id, c.id);
  }
  const templateIdMap = new Map<string, string>();
  // First pass — create without dependencies
  for (const t of source.templates) {
    const c = await prisma.soeTaskTemplate.create({
      data: {
        studyId: clone.id,
        timepointId: t.timepointId
          ? timepointIdMap.get(t.timepointId) ?? null
          : null,
        name: t.name,
        description: t.description,
        kind: t.kind,
        triggerType: t.triggerType,
        reminderOffsetDays: t.reminderOffsetDays,
        sortOrder: t.sortOrder,
      },
    });
    templateIdMap.set(t.id, c.id);
  }
  // Second pass — apply dependsOnTemplateId references
  for (const t of source.templates) {
    if (!t.dependsOnTemplateId) continue;
    const newSelfId = templateIdMap.get(t.id);
    const newDepId = templateIdMap.get(t.dependsOnTemplateId);
    if (newSelfId && newDepId) {
      await prisma.soeTaskTemplate.update({
        where: { id: newSelfId },
        data: { dependsOnTemplateId: newDepId },
      });
    }
  }
  for (const r of source.paymentRules) {
    await prisma.paymentRule.create({
      data: {
        studyId: clone.id,
        name: r.name,
        trigger: r.trigger,
        templateId: r.templateId
          ? templateIdMap.get(r.templateId) ?? null
          : null,
        timepointId: r.timepointId
          ? timepointIdMap.get(r.timepointId) ?? null
          : null,
        amountCents: r.amountCents,
        currency: r.currency,
        settlementGated: r.settlementGated,
        active: r.active,
      },
    });
  }
  for (const b of source.budgetLines) {
    await prisma.budgetLine.create({
      data: {
        studyId: clone.id,
        category: b.category,
        description: b.description,
        plannedCents: b.plannedCents,
      },
    });
  }
  for (const a of source.aeTemplates) {
    await prisma.aeReportTemplate.create({
      data: {
        studyId: clone.id,
        name: a.name,
        fields: a.fields,
        autoStreamPause: a.autoStreamPause,
        active: a.active,
      },
    });
  }
  for (const m of source.messageTemplates) {
    await prisma.messageTemplate.create({
      data: {
        studyId: clone.id,
        channel: m.channel,
        name: m.name,
        subject: m.subject,
        body: m.body,
        variables: m.variables,
        active: m.active,
      },
    });
  }

  await appendAudit({
    actor: { kind: "STAFF", label: roleLabel(role) },
    action: "STUDY_CLONED",
    targetType: "Study",
    targetId: clone.id,
    studyId: clone.id,
    metadata: {
      from: source.id,
      armCount: armIdMap.size,
      timepointCount: timepointIdMap.size,
      taskCount: templateIdMap.size,
    },
  });

  revalidatePath("/admin");
  redirect(`/admin/studies/${clone.id}/edit`);
}
